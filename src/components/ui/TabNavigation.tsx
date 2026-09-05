import { Tabs, Tab, Badge } from '@mui/material';
import { styled } from '@mui/material/styles';

interface TabItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface TabNavigationProps {
  tabs: TabItem[];
  activeTab: string;
  onChange: (tabId: string) => void;
  variant?: 'standard' | 'scrollable' | 'fullWidth';
}

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  '& .MuiTab-root': { minHeight: 48, textTransform: 'none', fontWeight: 500 },
}));

export default function TabNavigation({ tabs, activeTab, onChange, variant = 'standard' }: TabNavigationProps) {
  return (
    <StyledTabs value={activeTab} onChange={(_, v) => onChange(v)} variant={variant}>
      {tabs.map((tab) => (
        <Tab
          key={tab.id}
          value={tab.id}
          label={tab.badge ? <Badge badgeContent={tab.badge} color="error">{tab.label}</Badge> : tab.label}
          icon={tab.icon}
          disabled={tab.disabled}
        />
      ))}
    </StyledTabs>
  );
}
