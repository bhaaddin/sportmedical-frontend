import { useState, useEffect } from 'react';
import { Box, Typography, Paper, Grid, Card, CardContent, LinearProgress, Avatar, List, ListItem, ListItemAvatar, ListItemText, Divider } from '@mui/material';
import { Stars, CardGiftcard, TrendingUp, History } from '@mui/icons-material';
import { loyaltyService } from '../../services/loyaltyService';

interface LoyaltyData {
  points: { total: number; earned: number; redeemed: number };
  tier: string;
  nextTier: string;
  pointsToNextTier: number;
  recentTransactions: any[];
  availableRewards: any[];
}

const tierColors: Record<string, string> = { Bronze: '#CD7F32', Silver: '#C0C0C0', Gold: '#FFD700', Platinum: '#E5E4E2' };
const tierThresholds: Record<string, number> = { Bronze: 0, Silver: 1000, Gold: 5000, Platinum: 10000 };

export default function LoyaltyDashboard({ customerId }: { customerId: string }) {
  const [data, setData] = useState<LoyaltyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [points, tier] = await Promise.all([
          loyaltyService.getPointsBalance(customerId),
          loyaltyService.getTier(customerId),
        ]);
        setData({
          points: { total: points.total, earned: points.earned, redeemed: points.redeemed },
          tier,
          nextTier: tier === 'Bronze' ? 'Silver' : tier === 'Silver' ? 'Gold' : tier === 'Gold' ? 'Platinum' : 'Platinum',
          pointsToNextTier: tier === 'Platinum' ? 0 : tierThresholds[tier === 'Bronze' ? 'Silver' : tier === 'Silver' ? 'Gold' : 'Platinum'] - points.total,
          recentTransactions: [],
          availableRewards: [],
        });
      } catch (error) {
        console.error('Failed to load loyalty data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [customerId]);

  if (loading || !data) return <Box sx={{ p: 3 }}>Načítání...</Box>;

  const tierProgress = data.tier === 'Platinum' ? 100 : (data.points.total / (tierThresholds[data.nextTier] || 1)) * 100;

  return (
    <Box>
      <Paper sx={{ p: 4, background: `linear-gradient(135deg, ${tierColors[data.tier]} 0%, ${tierColors[data.tier]}80 100%)`, color: 'white', mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
              <Avatar sx={{ width: 64, height: 64, bgcolor: 'rgba(255,255,255,0.2)' }}><Stars sx={{ fontSize: 32 }} /></Avatar>
              <Box>
                <Typography variant="h4" fontWeight={700}>{data.points.total}</Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>Věrnostních bodů</Typography>
              </Box>
            </Box>
            <Typography variant="h6">{data.tier} člen</Typography>
            {data.tier !== 'Platinum' && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ mb: 1 }}>{data.pointsToNextTier} bodů do {data.nextTier}</Typography>
                <LinearProgress variant="determinate" value={tierProgress} sx={{ height: 8, borderRadius: 4, bgcolor: 'rgba(255,255,255,0.3)', '& .MuiLinearProgress-bar': { bgcolor: 'white' } }} />
              </Box>
            )}
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Card sx={{ flex: 1 }}><CardContent sx={{ textAlign: 'center' }}><TrendingUp color="primary" sx={{ fontSize: 32, mb: 1 }} /><Typography variant="h5">{data.points.earned}</Typography><Typography variant="body2" color="text.secondary">Získáno</Typography></CardContent></Card>
              <Card sx={{ flex: 1 }}><CardContent sx={{ textAlign: 'center' }}><CardGiftcard color="secondary" sx={{ fontSize: 32, mb: 1 }} /><Typography variant="h5">{data.points.redeemed}</Typography><Typography variant="body2" color="text.secondary">Využito</Typography></CardContent></Card>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom><History sx={{ mr: 1, verticalAlign: 'middle' }} />Poslední transakce</Typography>
            <List>
              {data.recentTransactions.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 2 }}>Žádné transakce</Typography>
              ) : (
                data.recentTransactions.slice(0, 5).map((t: any, i: number) => (
                  <Box key={t.id || i}>
                    <ListItem>
                      <ListItemAvatar><Avatar sx={{ bgcolor: t.type === 'earned' ? 'success.main' : 'error.main', width: 40, height: 40 }}>{t.type === 'earned' ? '+' : '-'}{t.points}</Avatar></ListItemAvatar>
                      <ListItemText primary={t.description} secondary={new Date(t.createdAt).toLocaleDateString('cs-CZ')} />
                    </ListItem>
                    {i < data.recentTransactions.length - 1 && <Divider />}
                  </Box>
                ))
              )}
            </List>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom><CardGiftcard sx={{ mr: 1, verticalAlign: 'middle' }} />Odměny</Typography>
            {data.availableRewards.length === 0 ? (
              <Typography color="text.secondary">Žádné odměny k dispozici</Typography>
            ) : (
              data.availableRewards.slice(0, 5).map((r: any) => (
                <Box key={r.id} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1 }}>
                  <Typography>{r.name}</Typography>
                  <Typography color="primary">{r.pointsRequired} bodů</Typography>
                </Box>
              ))
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
