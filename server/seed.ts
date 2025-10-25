import { storage } from "./storage";

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

  // Create spaces
  const productSpace = await storage.createSpace({
    organizationId: org.id,
    name: "Product Vision 2025",
    purpose: "Envision the future of our product roadmap and prioritize key initiatives for next year",
    status: "open",
    hidden: false,
  });
  console.log("✓ Created space:", productSpace.name);

  const workshopSpace = await storage.createSpace({
    organizationId: org.id,
    name: "Customer Experience Workshop",
    purpose: "Brainstorm and rank improvements to enhance customer satisfaction and retention",
    status: "draft",
    hidden: false,
  });
  console.log("✓ Created space:", workshopSpace.name);

  const leadershipSpace = await storage.createSpace({
    organizationId: org.id,
    name: "Leadership Strategy Retreat",
    purpose: "Executive team strategic planning session (facilitators and admins only)",
    status: "open",
    hidden: true,
  });
  console.log("✓ Created hidden space:", leadershipSpace.name);

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
