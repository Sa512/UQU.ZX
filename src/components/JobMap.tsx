import { forwardRef } from 'react';
import type { Company, LatLng } from '@/lib/jobHunt';

export type JobMapHandle = { moveTo: (c: LatLng) => void };

type Props = { pin: LatLng; radiusM: number; companies: Company[]; color: string; onPick: (c: LatLng) => void };

/** الخريطة متاحة على الآيفون فقط (Apple Maps)؛ غيره يكتفي بالموقع الحالي أو البحث بالاسم. */
export const JobMap = forwardRef<JobMapHandle, Props>(function JobMap(_props, _ref) {
  return null;
});
