// Coach testimonials shown on the landing page.
//
// These are PLACEHOLDERS until real coaches come on board. Fill in `quote`,
// `name` and `team` (and optionally `photo`, a path under /public such as
// "/images/coaches/jane.jpg"). An entry with an empty quote renders as a
// clearly-marked empty slot, so nothing here ever reads as a fake review.
export interface Testimonial {
  quote: string;
  name: string;
  team: string;
  photo: string | null;
}

export const TESTIMONIALS: Testimonial[] = [
  { quote: "", name: "", team: "", photo: null },
  { quote: "", name: "", team: "", photo: null },
  { quote: "", name: "", team: "", photo: null },
];
