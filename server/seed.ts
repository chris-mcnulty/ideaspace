import { storage } from "./storage";
import { hashPassword } from "./auth";

async function seed() {
  console.log("🌱 Seeding database...");

  // Create an organization
  const org = await storage.createOrganization({
    name: "Acme Corporation",
    slug: "acme",
    logoUrl: null,
    primaryColor: "#3b82f6",
  });
  console.log("✓ Created organization:", org.name);

  // Create users with different roles (password: "password123" for all, hashed)
  const hashedPassword = await hashPassword("password123");
  
  const globalAdmin = await storage.createUser({
    email: "admin@synozur.com",
    username: "globaladmin",
    password: hashedPassword,
    role: "global_admin",
    displayName: "Global Administrator",
    organizationId: null,
  });
  
  const companyAdmin = await storage.createUser({
    email: "admin@acme.com",
    username: "acmeadmin",
    password: hashedPassword,
    role: "company_admin",
    displayName: "Acme Administrator",
    organizationId: org.id,
  });
  
  const facilitator = await storage.createUser({
    email: "facilitator@acme.com",
    username: "facilitator1",
    password: hashedPassword,
    role: "facilitator",
    displayName: "Jane Facilitator",
    organizationId: org.id,
  });
  
  const regularUser = await storage.createUser({
    email: "user@acme.com",
    username: "user1",
    password: hashedPassword,
    role: "user",
    displayName: "John User",
    organizationId: org.id,
  });
  
  console.log("✓ Created 4 users with different roles (password: password123)");

  // Assign company admin to Acme organization
  await storage.createCompanyAdmin({
    userId: companyAdmin.id,
    organizationId: org.id,
  });
  console.log("✓ Assigned company admin to Acme");

  // Create spaces with 4-digit codes
  const productSpace = await storage.createSpace({
    organizationId: org.id,
    name: "Product Vision 2025",
    purpose: "Envision the future of our product roadmap and prioritize key initiatives for next year",
    code: "1234",
    status: "open",
    hidden: false,
    guestAllowed: true, // Allow guests for testing
  });
  console.log("✓ Created space:", productSpace.name, `(Code: ${productSpace.code})`);

  const workshopSpace = await storage.createSpace({
    organizationId: org.id,
    name: "Customer Experience Workshop",
    purpose: "Brainstorm and rank improvements to enhance customer satisfaction and retention",
    code: "5678",
    status: "draft",
    hidden: false,
    guestAllowed: false, // Default: no guests
  });
  console.log("✓ Created space:", workshopSpace.name, `(Code: ${workshopSpace.code})`);

  const leadershipSpace = await storage.createSpace({
    organizationId: org.id,
    name: "Leadership Strategy Retreat",
    purpose: "Executive team strategic planning session (facilitators and admins only)",
    code: "9012",
    status: "open",
    hidden: true,
    guestAllowed: false,
  });
  console.log("✓ Created hidden space:", leadershipSpace.name, `(Code: ${leadershipSpace.code})`);

  // Assign facilitator to Product Vision space
  await storage.createSpaceFacilitator({
    userId: facilitator.id,
    spaceId: productSpace.id,
  });
  console.log("✓ Assigned facilitator to Product Vision space");

  // Create some participants
  const alice = await storage.createParticipant({
    spaceId: productSpace.id,
    userId: null,
    displayName: "Alice Johnson",
    isGuest: false,
    isOnline: true,
    profileData: { email: "alice@acme.com", company: "Acme Corp", jobTitle: "Product Manager" },
  });

  const bob = await storage.createParticipant({
    spaceId: productSpace.id,
    userId: null,
    displayName: "Bob Smith",
    isGuest: false,
    isOnline: true,
    profileData: { email: "bob@acme.com", company: "Acme Corp", jobTitle: "Engineering Lead" },
  });

  const guest1 = await storage.createParticipant({
    spaceId: productSpace.id,
    userId: null,
    displayName: "Powerful Andromeda",
    isGuest: true,
    isOnline: true,
    profileData: null,
  });

  const guest2 = await storage.createParticipant({
    spaceId: productSpace.id,
    userId: null,
    displayName: "Radiant Sirius",
    isGuest: true,
    isOnline: false,
    profileData: null,
  });

  console.log("✓ Created 4 participants");

  // Create some notes
  await storage.createNote({
    spaceId: productSpace.id,
    participantId: alice.id,
    content: "Improve customer onboarding with personalized tutorials and step-by-step guidance",
    category: "User Experience",
    isAiCategory: false,
  });

  await storage.createNote({
    spaceId: productSpace.id,
    participantId: bob.id,
    content: "Implement real-time collaboration features for remote teams",
    category: "Product Features",
    isAiCategory: true,
  });

  await storage.createNote({
    spaceId: productSpace.id,
    participantId: guest1.id,
    content: "Optimize application performance and reduce page load times",
    category: "Technical",
    isAiCategory: false,
  });

  await storage.createNote({
    spaceId: productSpace.id,
    participantId: guest2.id,
    content: "Add mobile app support for iOS and Android platforms",
    category: "Product Features",
    isAiCategory: true,
  });

  await storage.createNote({
    spaceId: productSpace.id,
    participantId: alice.id,
    content: "Enhance data security and implement advanced privacy controls",
    category: "Security",
    isAiCategory: false,
  });

  console.log("✓ Created 5 notes");

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
