import './index.css';
import DashboardLayout from './layouts/DashboardLayout';
import useRooms from './hooks/useRooms';

export default function App() {
  const roomsState = useRooms();

  return <DashboardLayout {...roomsState} />;
}
