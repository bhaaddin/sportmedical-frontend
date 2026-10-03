import {
  EventAvailable, MedicalServices, Groups, ForumOutlined, DescriptionOutlined, LanguageOutlined, AdminPanelSettingsOutlined,
} from '@mui/icons-material';
import type { SettingsGroupIcon } from '../../pages/settings/catalogue';

/** The icon a group's tile wears. */
export function GroupIcon({ name, sx }: { name: SettingsGroupIcon; sx?: object }) {
  const props = { sx: { fontSize: 28, ...sx }, 'aria-hidden': true } as const;
  switch (name) {
    case 'provoz': return <EventAvailable {...props} />;
    case 'sluzby': return <MedicalServices {...props} />;
    case 'kluby': return <Groups {...props} />;
    case 'komunikace': return <ForumOutlined {...props} />;
    case 'dokumenty': return <DescriptionOutlined {...props} />;
    case 'web': return <LanguageOutlined {...props} />;
    default: return <AdminPanelSettingsOutlined {...props} />;
  }
}
