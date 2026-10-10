import { AppleMaps } from 'expo-maps';
import { forwardRef, useImperativeHandle, useRef } from 'react';
import type { Company, LatLng } from '@/lib/jobHunt';

export type JobMapHandle = { moveTo: (c: LatLng) => void };

type Props = { pin: LatLng; radiusM: number; companies: Company[]; color: string; onPick: (c: LatLng) => void };

/** خريطة Apple: اضغط على أي مكان لتحديد موقع البحث. */
export const JobMap = forwardRef<JobMapHandle, Props>(function JobMap({ pin, radiusM, companies, color, onPick }, ref) {
  const map = useRef<AppleMaps.MapView>(null);
  useImperativeHandle(ref, () => ({ moveTo: (c) => map.current?.setCameraPosition({ coordinates: c, zoom: 13 }) }), []);
  return (
    <AppleMaps.View
      ref={map}
      style={{ flex: 1 }}
      cameraPosition={{ coordinates: pin, zoom: 13 }}
      uiSettings={{ myLocationButtonEnabled: false, compassEnabled: false }}
      onMapClick={({ coordinates }) => {
        if (coordinates.latitude != null && coordinates.longitude != null) onPick({ latitude: coordinates.latitude, longitude: coordinates.longitude });
      }}
      circles={[{ id: 'area', center: pin, radius: radiusM, color: color + '22', lineColor: color, lineWidth: 1.5 }]}
      markers={[
        { id: 'pin', coordinates: pin, systemImage: 'mappin', tintColor: color, title: 'موقع البحث' },
        ...companies
          .filter((c) => c.emails.length)
          .slice(0, 80)
          .map((c) => ({ id: c.id, coordinates: c.coords, systemImage: 'envelope.fill', tintColor: '#10B981', title: c.name })),
      ]}
    />
  );
});
