// Research portals are starting points, not evidence of individual legal review.
export const BLOG_REVIEW_NOTICE = "Published by Al Wakeelo. An individual legal reviewer is not recorded for this guide. Verify the current law and relevant Gazette notifications before relying on it.";

export const BLOG_RESEARCH_SOURCES = [
  { title: "Pakistan Code — Ministry of Law and Justice", url: "https://www.pakistancode.gov.pk/english/" },
  { title: "Supreme Court of Pakistan — official court website", url: "https://www.supremecourt.gov.pk/" },
];

export function blogReadMinutes(content: string): number {
  return Math.max(1, Math.ceil(content.trim().split(/\s+/).filter(Boolean).length / 200));
}
