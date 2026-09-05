import { useState } from 'react';
import { Box, Typography, Paper, Collapse, List, ListItem, ListItemIcon, ListItemText } from '@mui/material';
import { HelpOutline, ExpandMore, ExpandLess, Info, Lightbulb, Warning, CheckCircle } from '@mui/icons-material';

interface HelpItem {
  id: string;
  icon?: React.ReactNode;
  title: string;
  content: string;
  type?: 'info' | 'tip' | 'warning' | 'success';
}

interface ContextualHelpProps {
  title?: string;
  items: HelpItem[];
  defaultExpanded?: boolean;
}

const typeIcons = {
  info: <Info color="info" />,
  tip: <Lightbulb color="warning" />,
  warning: <Warning color="warning" />,
  success: <CheckCircle color="success" />,
};

export default function ContextualHelp({ title = 'Nápověda', items, defaultExpanded = false }: ContextualHelpProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }} onClick={() => setExpanded(!expanded)}>
        <Box display="flex" alignItems="center" gap={1}>
          <HelpOutline color="primary" />
          <Typography variant="subtitle1">{title}</Typography>
        </Box>
        {expanded ? <ExpandLess /> : <ExpandMore />}
      </Box>
      <Collapse in={expanded}>
        <List dense sx={{ pt: 0 }}>
          {items.map((item) => (
            <ListItem key={item.id} alignItems="flex-start">
              <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>{item.icon || typeIcons[item.type || 'info']}</ListItemIcon>
              <ListItemText primary={item.title} secondary={item.content} primaryTypographyProps={{ variant: 'subtitle2' }} secondaryTypographyProps={{ variant: 'body2' }} />
            </ListItem>
          ))}
        </List>
      </Collapse>
    </Paper>
  );
}
