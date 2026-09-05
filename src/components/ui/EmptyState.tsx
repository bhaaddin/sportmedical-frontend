import { Box, Typography, Button } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Add as AddIcon } from '@mui/icons-material';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}

const EmptyContainer = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(8),
  textAlign: 'center',
  minHeight: 300,
}));

export default function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <EmptyContainer>
      {icon && (
        <Box sx={{ p: 3, borderRadius: '50%', bgcolor: 'action.hover', color: 'text.secondary', mb: 3 }}>
          {icon}
        </Box>
      )}
      <Typography variant="h6" gutterBottom>{title}</Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: 3 }}>
          {description}
        </Typography>
      )}
      {action && (
        <Button variant="contained" startIcon={<AddIcon />} onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </EmptyContainer>
  );
}
