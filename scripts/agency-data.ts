// Fictional data for "Lumen & Pine Studio", a small web design and marketing
// agency. Contacts are its clients and prospects. Everything here is invented.

export interface SeedContact {
  firstName: string;
  lastName: string;
  company: string;
  jobTitle: string;
  stage: string;
  domain: string;
}

export interface SeedDeal {
  name: string;
  contactEmail: string;
  amount: number;
  stage: string;
  closeDate: string;
}

export const emailOf = ({ firstName, lastName, domain }: SeedContact) =>
  `${firstName}.${lastName}@${domain}.example.com`
    .toLowerCase()
    .replace(/[^a-z0-9.@-]/g, "");

export const contacts: SeedContact[] = [
  { firstName: "Ana", lastName: "Rivera", company: "Brightside Bakery", jobTitle: "Owner", stage: "customer", domain: "brightsidebakery" },
  { firstName: "Marcus", lastName: "Bell", company: "Harbor & Oak Coffee", jobTitle: "Co-founder", stage: "customer", domain: "harborandoak" },
  { firstName: "Priya", lastName: "Nair", company: "Northfield Dental", jobTitle: "Practice Manager", stage: "opportunity", domain: "northfielddental" },
  { firstName: "Tom", lastName: "Alvarez", company: "Alvarez Landscaping", jobTitle: "Owner", stage: "customer", domain: "alvarezlandscaping" },
  { firstName: "Chloe", lastName: "Dubois", company: "Maison Dubois Florals", jobTitle: "Owner", stage: "lead", domain: "maisondubois" },
  { firstName: "Jamal", lastName: "Harris", company: "Harris & Sons Plumbing", jobTitle: "Owner", stage: "opportunity", domain: "harrisandsons" },
  { firstName: "Elena", lastName: "Petrova", company: "Petrova Pilates Studio", jobTitle: "Founder", stage: "customer", domain: "petrovapilates" },
  { firstName: "Noah", lastName: "Kim", company: "Kim's Corner Market", jobTitle: "Owner", stage: "lead", domain: "kimscorner" },
  { firstName: "Sofia", lastName: "Marino", company: "Marino Family Pizzeria", jobTitle: "Owner", stage: "salesqualifiedlead", domain: "marinopizzeria" },
  { firstName: "Liam", lastName: "OConnor", company: "O'Connor Realty Group", jobTitle: "Broker", stage: "opportunity", domain: "oconnorrealty" },
  { firstName: "Grace", lastName: "Okafor", company: "Okafor Accounting", jobTitle: "Partner", stage: "customer", domain: "okaforaccounting" },
  { firstName: "Ben", lastName: "Fischer", company: "Fischer Bikes", jobTitle: "Owner", stage: "lead", domain: "fischerbikes" },
  { firstName: "Hannah", lastName: "Lee", company: "Lee Veterinary Clinic", jobTitle: "Office Manager", stage: "marketingqualifiedlead", domain: "leevet" },
  { firstName: "Diego", lastName: "Torres", company: "Torres Auto Repair", jobTitle: "Owner", stage: "customer", domain: "torresauto" },
  { firstName: "Mia", lastName: "Johansson", company: "Nordic Knit Co.", jobTitle: "Founder", stage: "opportunity", domain: "nordicknit" },
  { firstName: "Omar", lastName: "Haddad", company: "Haddad Tea House", jobTitle: "Owner", stage: "lead", domain: "haddadtea" },
  { firstName: "Rachel", lastName: "Stein", company: "Stein Law Office", jobTitle: "Managing Partner", stage: "salesqualifiedlead", domain: "steinlaw" },
  { firstName: "Victor", lastName: "Chen", company: "Chen Print Shop", jobTitle: "Owner", stage: "customer", domain: "chenprint" },
  { firstName: "Isabel", lastName: "Costa", company: "Costa Yoga & Wellness", jobTitle: "Founder", stage: "marketingqualifiedlead", domain: "costayoga" },
  { firstName: "Sam", lastName: "Patel", company: "Patel Pharmacy", jobTitle: "Owner", stage: "subscriber", domain: "patelpharmacy" },
];

const emailFor = (lastName: string) => {
  const contact = contacts.find((c) => c.lastName === lastName);
  if (!contact) throw new Error(`Unknown seed contact: ${lastName}`);
  return emailOf(contact);
};

export const deals: SeedDeal[] = [
  { name: "Brightside Bakery - Website redesign", contactEmail: emailFor("Rivera"), amount: 4800, stage: "closedwon", closeDate: "2026-08-14" },
  { name: "Harbor & Oak - Monthly social media retainer", contactEmail: emailFor("Bell"), amount: 1500, stage: "closedwon", closeDate: "2026-09-02" },
  { name: "Northfield Dental - New website and booking", contactEmail: emailFor("Nair"), amount: 7200, stage: "presentationscheduled", closeDate: "2026-11-20" },
  { name: "Alvarez Landscaping - SEO package", contactEmail: emailFor("Alvarez"), amount: 2400, stage: "contractsent", closeDate: "2026-11-05" },
  { name: "Harris & Sons - Local ads campaign", contactEmail: emailFor("Harris"), amount: 3100, stage: "qualifiedtobuy", closeDate: "2026-12-01" },
  { name: "Petrova Pilates - Brand refresh", contactEmail: emailFor("Petrova"), amount: 3600, stage: "closedwon", closeDate: "2026-07-22" },
  { name: "O'Connor Realty - Listings microsite", contactEmail: emailFor("OConnor"), amount: 8900, stage: "decisionmakerboughtin", closeDate: "2026-11-30" },
  { name: "Nordic Knit - E-commerce build", contactEmail: emailFor("Johansson"), amount: 12500, stage: "appointmentscheduled", closeDate: "2026-12-15" },
];
