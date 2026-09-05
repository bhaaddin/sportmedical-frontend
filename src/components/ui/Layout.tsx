import { ReactNode } from 'react';
import { Box, Container, Paper, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';

// Page Layout with header
interface PageLayoutProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: { label: string; path?: string }[];
  children: ReactNode;
}

export function PageLayout({
  title,
  subtitle,
  actions,
  breadcrumbs,
  children,
}: PageLayoutProps) {
  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Container maxWidth="xl" sx={{ py: 4 }}>
        {breadcrumbs && (
          <Box sx={{ mb: 2 }}>
            {breadcrumbs.map((crumb, index) => (
              <Typography
                key={index}
                component="span"
                variant="caption"
                color={crumb.path ? 'primary' : 'text.secondary'}
                sx={{ cursor: crumb.path ? 'pointer' : 'default' }}
              >
                {crumb.label}
                {index < breadcrumbs.length - 1 && ' / '}
              </Typography>
            ))}
          </Box>
        )}

        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="flex-start"
          mb={4}
        >
          <Box>
            <Typography variant="h4" component="h1" gutterBottom>
              {title}
            </Typography>
            {subtitle && (
              <Typography variant="body1" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && <Box display="flex" gap={1}>{actions}</Box>}
        </Box>

        {children}
      </Container>
    </Box>
  );
}

// Content Card
interface ContentCardProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  noPadding?: boolean;
}

const StyledPaper = styled(Paper)(({ theme }) => ({
  borderRadius: (theme.shape.borderRadius ?? 8) * 1.5,
  boxShadow: theme.shadows[1],
}));

export function ContentCard({
  title,
  subtitle,
  actions,
  children,
  noPadding = false,
}: ContentCardProps) {
  return (
    <StyledPaper>
      {(title || actions) && (
        <Box
          sx={{
            p: noPadding ? 0 : 3,
            pb: noPadding ? 0 : 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Box>
            {title && (
              <Typography variant="h6" gutterBottom={!!subtitle}>
                {title}
              </Typography>
            )}
            {subtitle && (
              <Typography variant="body2" color="text.secondary">
                {subtitle}
              </Typography>
            )}
          </Box>
          {actions && <Box display="flex" gap={1}>{actions}</Box>}
        </Box>
      )}
      <Box sx={{ p: noPadding ? 0 : 3, pt: title ? 2 : 3 }}>
        {children}
      </Box>
    </StyledPaper>
  );
}

// Stats Card
interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    trend: 'up' | 'down';
  };
  icon: ReactNode;
  color?: string;
}

export function StatsCard({
  title,
  value,
  change,
  icon,
  color = '#1976D2',
}: StatsCardProps) {
  return (
    <StyledPaper sx={{ p: 3 }}>
      <Box display="flex" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            {title}
          </Typography>
          <Typography variant="h4" fontWeight={600}>
            {value}
          </Typography>
          {change && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                color: change.trend === 'up' ? 'success.main' : 'error.main',
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              {change.trend === 'up' ? '↑' : '↓'} {Math.abs(change.value)}%
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: color + '15',
            color: color,
          }}
        >
          {icon}
        </Box>
      </Box>
    </StyledPaper>
  );
}
