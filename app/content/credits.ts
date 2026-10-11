export interface Person {
  name: string;
  /** What they do or did. Omitted for the crew list, where names are enough. */
  role?: string;
  href?: string;
}

/**
 * Who makes the gate happen now. Names only, in the order given; the work is
 * shared enough that titles would mislead.
 */
export const CREW: Person[] = [
  { name: "The Entheos Community", href: "https://www.entheosrising.org/" },
  { name: "James Tramel" },
  { name: "Cameron Tacklind" },
  { name: "Allison Bellows" },
  { name: "Theodore Wahrburg" },
];

/**
 * Earlier contributors whose work the gate was built on. Original-design
 * credit stays as a line of names and nothing more.
 */
export const EARLIER: Person[] = [
  {
    name: "Anthony Fieldman, James Tramel",
    role: "Original design, 2022",
  },
  {
    name: "Michael Kennedy, James Scott",
    role: "Fabrication, 2022",
  },
  {
    name: "Andris Kasparovics",
    role: "Original lighting, 2022",
  },
  {
    name: "Eric Vicenti",
    role: "Light software for unSCruz 2024",
  },
];
