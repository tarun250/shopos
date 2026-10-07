import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsOptional, IsString, Length, Matches } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ROLES, UsersService } from './users.service';

const PASSWORD_RULE = /^(?=.*[A-Za-z])(?=.*\d).{8,72}$/;
const PASSWORD_MESSAGE = 'password must be 8-72 characters with at least one letter and one number';

export class CreateUserDto {
  @IsString() @Matches(/^[a-zA-Z0-9._-]{3,30}$/, { message: 'username must be 3-30 letters, numbers, dots, dashes or underscores' }) username: string;
  @IsString() @Length(2, 80) fullName: string;
  @IsEmail() email: string;
  @IsIn([...ROLES]) role: string;
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) password: string;
  @IsString() @Matches(/^\d{4}$/, { message: 'pin must be exactly 4 digits' }) pin: string;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @Length(2, 80) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsIn([...ROLES]) role?: string;
}

export class ResetPasswordDto {
  @IsString() @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE }) password: string;
}

export class ResetPinDto {
  @IsString() @Matches(/^\d{4}$/, { message: 'pin must be exactly 4 digits' }) pin: string;
}

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('OWNER')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list() {
    return this.users.list();
  }

  @Post()
  create(@Req() req: any, @Body() body: CreateUserDto) {
    return this.users.create(body, req.user.userId);
  }

  @Put(':id')
  update(@Req() req: any, @Param('id') id: string, @Body() body: UpdateUserDto) {
    return this.users.update(id, body, req.user.userId);
  }

  @Post(':id/reset-password')
  resetPassword(@Req() req: any, @Param('id') id: string, @Body() body: ResetPasswordDto) {
    return this.users.resetPassword(id, body.password, req.user.userId);
  }

  @Post(':id/reset-pin')
  resetPin(@Req() req: any, @Param('id') id: string, @Body() body: ResetPinDto) {
    return this.users.resetPin(id, body.pin, req.user.userId);
  }

  @Post(':id/deactivate')
  deactivate(@Req() req: any, @Param('id') id: string) {
    return this.users.setActive(id, false, req.user.userId);
  }

  @Post(':id/activate')
  activate(@Req() req: any, @Param('id') id: string) {
    return this.users.setActive(id, true, req.user.userId);
  }
}
