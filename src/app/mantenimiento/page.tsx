import MaintenanceScreen from '@/components/MaintenanceScreen';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Mantenimiento' };

/** Vista de la pantalla de mantenimiento (también sirve de vista previa al admin). */
export default function MaintenancePage() {
  return <MaintenanceScreen preview />;
}
