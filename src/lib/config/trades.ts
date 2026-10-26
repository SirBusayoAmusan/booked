// Landing pages per trade. Sample weeks are illustrations of the format, not
// real customer results: no names, numbers or testimonials.
export type Trade = {
  slug: string;
  name: string; // plural, lower case, used in "for [trade] owners"
  label: string;
  sampleWeek: { day: string; platform: string; hook: string; noFilming?: boolean }[];
  shootDay: { minutes: number; shots: string[] };
};

export const TRADES: Trade[] = [
  {
    slug: "detailers",
    name: "mobile detailing",
    label: "Mobile detailers",
    sampleWeek: [
      { day: "Mon", platform: "Instagram", hook: "This is what 6 months of dog hair looks like (and 40 minutes later)" },
      { day: "Wed", platform: "Facebook", hook: "Do you need a full detail or just a maintenance wash? Here's how to tell", noFilming: true },
      { day: "Thu", platform: "Google", hook: "Now booking driveway details in [your area] this week" },
      { day: "Sat", platform: "Instagram", hook: "The one spot everyone forgets to clean in their car" },
    ],
    shootDay: { minutes: 25, shots: ["Wide shot of the van arriving", "Close-up: pet hair before and after vacuum", "Slow pan across the finished paint", "Hands applying tyre shine"] },
  },
  {
    slug: "pressure-washing",
    name: "pressure and soft washing",
    label: "Pressure washers",
    sampleWeek: [
      { day: "Mon", platform: "Instagram", hook: "Watch this driveway turn back to its real colour" },
      { day: "Tue", platform: "Facebook", hook: "Soft wash or pressure wash? What your roof actually needs", noFilming: true },
      { day: "Thu", platform: "Google", hook: "Booking patios and driveways in [your area]" },
      { day: "Fri", platform: "TikTok", hook: "The satisfying stripe test" },
    ],
    shootDay: { minutes: 30, shots: ["Stripe test on a dirty patch", "Wide before shot from the street", "Same angle after", "Close-up of the surface cleaner"] },
  },
  {
    slug: "dog-grooming",
    name: "mobile dog grooming",
    label: "Mobile dog groomers",
    sampleWeek: [
      { day: "Mon", platform: "Instagram", hook: "Inside the van: why dogs stay calmer with mobile grooming" },
      { day: "Wed", platform: "Facebook", hook: "How often should your breed really be groomed?", noFilming: true },
      { day: "Thu", platform: "Instagram", hook: "Fluffy in, fluffy out: a full groom in 30 seconds" },
      { day: "Sat", platform: "Google", hook: "Weekend grooming slots in [your area]" },
    ],
    shootDay: { minutes: 20, shots: ["Van interior tour", "Hands-only clip of the dryer", "Finished groom on the table (with the owner's permission)", "Treat moment"] },
  },
  {
    slug: "party-rentals",
    name: "party and event rental",
    label: "Party rental businesses",
    sampleWeek: [
      { day: "Mon", platform: "Instagram", hook: "Setting up a bounce house in 12 minutes, start to finish" },
      { day: "Tue", platform: "Facebook", hook: "Checklist: what to ask before you book a party rental", noFilming: true },
      { day: "Thu", platform: "Instagram", hook: "Same backyard, two party setups. Which one?" },
      { day: "Fri", platform: "Google", hook: "Now taking bookings for [month] weekends" },
    ],
    shootDay: { minutes: 35, shots: ["Time-lapse of a setup", "Cleaning and sanitising the equipment", "Wide shot of a finished setup (no guests' faces)", "Loading the truck"] },
  },
  {
    slug: "barbers",
    name: "barber",
    label: "Barbers",
    sampleWeek: [
      { day: "Mon", platform: "Instagram", hook: "Low taper, start to finish, no talking" },
      { day: "Wed", platform: "Instagram", hook: "How to ask your barber for exactly the cut you want", noFilming: true },
      { day: "Thu", platform: "TikTok", hook: "The 3 tools on my station I'd never work without" },
      { day: "Sat", platform: "Google", hook: "Walk-ins and bookings this Saturday" },
    ],
    shootDay: { minutes: 20, shots: ["Overhead shot of the station", "Clipper close-up during a fade", "Finished cut, back and side (with client's OK)", "Sweeping up at closing"] },
  },
];

export const DEFAULT_TRADE = TRADES[0];

export function getTrade(slug: string) {
  return TRADES.find((t) => t.slug === slug) ?? null;
}
