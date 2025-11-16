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

  // Create users with different roles
  const seedPassword = process.env.SEED_PASSWORD || "password123";
  const hashedPassword = await hashPassword(seedPassword);
  
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
  
  console.log(`✓ Created 4 users with different roles (password: ${seedPassword})`);

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

  // Create 5 ocean-themed ideas for Cascadia Oceanic workspace
  const oceanIdeas = [
    {
      spaceId: cascadiaSpace.id,
      content: "Establish Marine Protected Areas covering 30% of coastal waters by 2030",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: cascadiaAdmin.id,
    },
    {
      spaceId: cascadiaSpace.id,
      content: "Deploy AI-powered ocean monitoring systems to track ecosystem health in real-time",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: cascadiaAdmin.id,
    },
    {
      spaceId: cascadiaSpace.id,
      content: "Implement blockchain-based plastic waste tracking from source to recycling",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: cascadiaAdmin.id,
    },
    {
      spaceId: cascadiaSpace.id,
      content: "Create community coral restoration programs with local dive operators",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: cascadiaAdmin.id,
    },
    {
      spaceId: cascadiaSpace.id,
      content: "Develop sustainable aquaculture alternatives to reduce wild fish harvesting",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: cascadiaAdmin.id,
    }
  ];

  await storage.bulkCreateIdeas(oceanIdeas);
  console.log("✓ Created 5 ocean-themed ideas for Cascadia workspace");

  // Create 5 tech ideas for Contoso workspace
  const techIdeas = [
    {
      spaceId: contosoSpace.id,
      content: "Migrate legacy infrastructure to cloud-native architecture",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: contosoAdmin.id,
    },
    {
      spaceId: contosoSpace.id,
      content: "Implement zero-trust security model across all systems",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: contosoAdmin.id,
    },
    {
      spaceId: contosoSpace.id,
      content: "Deploy AI-powered customer service chatbots",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: contosoAdmin.id,
    },
    {
      spaceId: contosoSpace.id,
      content: "Build real-time data analytics dashboard for executives",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: contosoAdmin.id,
    },
    {
      spaceId: contosoSpace.id,
      content: "Create employee wellness app with mental health resources",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: contosoAdmin.id,
    }
  ];

  await storage.bulkCreateIdeas(techIdeas);
  console.log("✓ Created 5 innovation ideas for Contoso workspace");

  // Create 5 manufacturing ideas for Fabrikam workspace
  const manufacturingIdeas = [
    {
      spaceId: fabrikamSpace.id,
      content: "Implement IoT sensors for predictive maintenance across all equipment",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: fabrikamAdmin.id,
    },
    {
      spaceId: fabrikamSpace.id,
      content: "Deploy robotic automation for high-risk manufacturing processes",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: fabrikamAdmin.id,
    },
    {
      spaceId: fabrikamSpace.id,
      content: "Create digital twin simulations for production optimization",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: fabrikamAdmin.id,
    },
    {
      spaceId: fabrikamSpace.id,
      content: "Establish carbon-neutral manufacturing processes by 2025",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: fabrikamAdmin.id,
    },
    {
      spaceId: fabrikamSpace.id,
      content: "Build augmented reality training programs for factory workers",
      contentType: "text" as const,
      sourceType: "preloaded" as const,
      createdByUserId: fabrikamAdmin.id,
    }
  ];

  await storage.bulkCreateIdeas(manufacturingIdeas);
  console.log("✓ Created 5 manufacturing ideas for Fabrikam workspace");

  console.log("🎉 Seeding complete!");
  process.exit(0);
}

seed().catch((error) => {
  console.error("❌ Seeding failed:", error);
  process.exit(1);
});
