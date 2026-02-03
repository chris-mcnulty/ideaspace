import bcrypt from 'bcryptjs';
import { db } from '../server/db';
import { users, organizations, projects, projectMembers } from '../shared/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

async function createTestAdmin() {
  const testEmail = 'testadmin@e2e.test';
  const testPassword = 'TestAdmin123!';
  
  // Check if test user already exists
  const existingUser = await db.select().from(users).where(eq(users.email, testEmail));
  if (existingUser.length > 0) {
    console.log('Test admin already exists:', testEmail);
    return;
  }
  
  // Get first organization
  const orgs = await db.select().from(organizations).limit(1);
  if (orgs.length === 0) {
    console.error('No organizations found. Create one first.');
    process.exit(1);
  }
  const org = orgs[0];
  
  // Get default project for the organization
  const defaultProject = await db.select().from(projects)
    .where(eq(projects.organizationId, org.id))
    .limit(1);
  
  // Hash password
  const hashedPassword = await bcrypt.hash(testPassword, 10);
  
  // Create test admin user
  const userId = randomUUID();
  await db.insert(users).values({
    id: userId,
    email: testEmail,
    username: 'testadmin',
    password: hashedPassword,
    role: 'company_admin',
    organizationId: org.id,
    isEmailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });
  
  // Add to default project if exists
  if (defaultProject.length > 0) {
    await db.insert(projectMembers).values({
      id: randomUUID(),
      projectId: defaultProject[0].id,
      userId: userId,
      role: 'admin',
      createdAt: new Date()
    });
    console.log('Added to project:', defaultProject[0].name);
  }
  
  console.log('Test admin created successfully!');
  console.log('Email:', testEmail);
  console.log('Password:', testPassword);
  console.log('Organization:', org.name);
}

createTestAdmin()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error creating test admin:', err);
    process.exit(1);
  });
