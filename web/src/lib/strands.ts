/** Research strands, read from the same adopter-owned record as every claim. */
import { cv, CV_SOURCE, entriesOf } from './cv';

export interface Strand {
  title: string;
  body: string;
  source: string;
  /** Notes naming the record evidence the author chose to associate with it. */
  evidence: string[];
}

export function strands(): Strand[] {
  return entriesOf(cv.strands).map((entry, index) => ({
    title: entry.title,
    body: entry.detail ?? '',
    source: `${CV_SOURCE} · strands[${index}]`,
    evidence: entry.items ?? [],
  }));
}
