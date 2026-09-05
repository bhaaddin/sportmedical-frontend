import { useState, ReactNode } from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography, Paper, IconButton } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  content: ReactNode;
}

interface OnboardingProps {
  steps: OnboardingStep[];
  onComplete: () => void;
  onSkip?: () => void;
  showSkip?: boolean;
}

export default function Onboarding({ steps, onComplete, onSkip, showSkip = true }: OnboardingProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const isLastStep = activeStep === steps.length - 1;

  if (isCompleted) return null;

  return (
    <Paper sx={{ position: 'fixed', bottom: 24, right: 24, width: 400, maxHeight: 'calc(100vh - 48px)', overflow: 'auto', zIndex: 1000, boxShadow: 6 }}>
      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h6">Průvodce</Typography>
        <Box>
          {showSkip && <Button onClick={() => { setIsCompleted(true); onSkip?.(); }} size="small">Přeskočit</Button>}
          <IconButton size="small" onClick={() => { setIsCompleted(true); onSkip?.(); }}><CloseIcon /></IconButton>
        </Box>
      </Box>

      <Stepper activeStep={activeStep} sx={{ px: 2, pb: 2 }}>
        {steps.map((step) => (
          <Step key={step.id}><StepLabel /></Step>
        ))}
      </Stepper>

      <Box sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>{steps[activeStep].title}</Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>{steps[activeStep].description}</Typography>
        <Box sx={{ mt: 2 }}>{steps[activeStep].content}</Box>
      </Box>

      <Box sx={{ p: 2, display: 'flex', justifyContent: 'space-between' }}>
        <Button disabled={activeStep === 0} onClick={() => setActiveStep(p => p - 1)}>Zpět</Button>
        <Button variant="contained" onClick={() => {
          if (isLastStep) { setIsCompleted(true); onComplete(); }
          else setActiveStep(p => p + 1);
        }}>{isLastStep ? 'Dokončit' : 'Další'}</Button>
      </Box>
    </Paper>
  );
}
