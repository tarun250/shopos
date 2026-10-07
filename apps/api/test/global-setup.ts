import { execSync } from 'child_process';
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { tmpdir } from 'os';

/**
 * Builds a template SQLite database by replaying every Prisma migration from scratch.
 * Each test file copies this template, so tests never touch the real dev.db and
 * migrations are verified to apply cleanly on an empty database.
 */
export default async function globalSetup() {
  const dbPackage = resolve(__dirname, '../../../packages/db');
  const workDir = join(tmpdir(), `shopos-test-${process.pid}`);
  rmSync(workDir, { recursive: true, force: true });
  mkdirSync(workDir, { recursive: true });

  cpSync(join(dbPackage, 'prisma/migrations'), join(workDir, 'migrations'), { recursive: true });
  const schema = readFileSync(join(dbPackage, 'prisma/schema.prisma'), 'utf8').replace(/url\s*=\s*"file:[^"]*"/, 'url = "file:./template.db"');
  writeFileSync(join(workDir, 'schema.prisma'), schema);

  execSync(`npx prisma migrate deploy --schema "${join(workDir, 'schema.prisma')}"`, { cwd: dbPackage, stdio: 'pipe' });
  process.env.SHOPOS_TEST_TEMPLATE_DB = join(workDir, 'template.db');
}
