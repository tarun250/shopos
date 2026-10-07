import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma.service';

export const ROLES = ['OWNER', 'MANAGER', 'CASHIER'] as const;
const PIN_ROLES = ['OWNER', 'MANAGER'];
const BCRYPT_ROUNDS = 12;

const publicFields = { id: true, username: true, email: true, fullName: true, role: true, isActive: true, createdAt: true, updatedAt: true };

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const users = await this.prisma.client.user.findMany({ select: publicFields, orderBy: [{ isActive: 'desc' }, { role: 'asc' }, { fullName: 'asc' }] });
    const lastLogins = await this.prisma.client.userSession.groupBy({ by: ['userId'], _max: { createdAt: true } });
    const byUser = new Map(lastLogins.map(l => [l.userId, l._max.createdAt]));
    return users.map(u => ({ ...u, lastLogin: byUser.get(u.id) || null }));
  }

  async create(input: { username: string; fullName: string; email: string; role: string; password: string; pin: string }, actorId: string) {
    const username = input.username.trim().toLowerCase();
    const email = input.email.trim().toLowerCase();
    const clash = await this.prisma.client.user.findFirst({ where: { OR: [{ username }, { email }] } });
    if (clash) throw new ConflictException(clash.username === username ? 'That username is taken' : 'That email is already used');
    if (PIN_ROLES.includes(input.role)) await this.assertPinUnique(input.pin);

    const user = await this.prisma.client.user.create({
      data: {
        username,
        email,
        fullName: input.fullName.trim(),
        role: input.role,
        passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
        pinHash: await bcrypt.hash(input.pin, BCRYPT_ROUNDS),
      },
      select: publicFields,
    });
    await this.audit(actorId, 'CREATE_USER', { userId: user.id, username, role: user.role });
    return user;
  }

  async update(id: string, input: { fullName?: string; email?: string; role?: string }, actorId: string) {
    const user = await this.get(id);
    if (input.role && input.role !== user.role) {
      if (id === actorId) throw new BadRequestException("You can't change your own role");
      if (user.role === 'OWNER') await this.assertAnotherActiveOwner(id);
    }
    if (input.email && input.email.toLowerCase() !== user.email) {
      const clash = await this.prisma.client.user.findFirst({ where: { email: input.email.toLowerCase(), NOT: { id } } });
      if (clash) throw new ConflictException('That email is already used');
    }
    const updated = await this.prisma.client.user.update({
      where: { id },
      data: { fullName: input.fullName?.trim(), email: input.email?.toLowerCase(), role: input.role },
      select: publicFields,
    });
    // Role changes take effect at next sign-in
    if (input.role && input.role !== user.role) await this.revokeSessions(id);
    await this.audit(actorId, 'UPDATE_USER', { userId: id, changes: input });
    return updated;
  }

  async resetPassword(id: string, password: string, actorId: string) {
    await this.get(id);
    await this.prisma.client.user.update({ where: { id }, data: { passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS) } });
    await this.revokeSessions(id);
    await this.audit(actorId, 'RESET_USER_PASSWORD', { userId: id });
    return { success: true };
  }

  async resetPin(id: string, pin: string, actorId: string) {
    const user = await this.get(id);
    if (PIN_ROLES.includes(user.role)) await this.assertPinUnique(pin, id);
    await this.prisma.client.user.update({ where: { id }, data: { pinHash: await bcrypt.hash(pin, BCRYPT_ROUNDS) } });
    await this.audit(actorId, 'RESET_USER_PIN', { userId: id });
    return { success: true };
  }

  async setActive(id: string, isActive: boolean, actorId: string) {
    const user = await this.get(id);
    if (!isActive) {
      if (id === actorId) throw new BadRequestException("You can't deactivate your own account");
      if (user.role === 'OWNER') await this.assertAnotherActiveOwner(id);
    }
    const updated = await this.prisma.client.user.update({ where: { id }, data: { isActive }, select: publicFields });
    if (!isActive) await this.revokeSessions(id);
    await this.audit(actorId, isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER', { userId: id });
    return updated;
  }

  private async get(id: string) {
    const user = await this.prisma.client.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  private async assertAnotherActiveOwner(excludingId: string) {
    const owners = await this.prisma.client.user.count({ where: { role: 'OWNER', isActive: true, NOT: { id: excludingId } } });
    if (owners === 0) throw new BadRequestException('There must always be at least one active owner');
  }

  /** Manager PIN approval matches a PIN against every approver, so approver PINs must be unique. */
  private async assertPinUnique(pin: string, excludingId?: string) {
    const approvers = await this.prisma.client.user.findMany({ where: { role: { in: PIN_ROLES }, isActive: true, ...(excludingId ? { NOT: { id: excludingId } } : {}) }, select: { pinHash: true } });
    for (const a of approvers) {
      if (await bcrypt.compare(pin, a.pinHash)) throw new ConflictException('That PIN is already used by another manager or owner; choose a different one');
    }
  }

  private revokeSessions(userId: string) {
    return this.prisma.client.userSession.updateMany({ where: { userId, isRevoked: false }, data: { isRevoked: true } });
  }

  private audit(userId: string, action: string, details: unknown) {
    return this.prisma.client.auditLog.create({ data: { userId, action, details: JSON.stringify(details) } });
  }
}
