import { useState, ReactNode } from 'react';
import { Box, Stepper, Step, StepLabel, Button, Typography } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

interface WizardStep {
  id: string;
  label: string;
  description?: string;
}

interface WizardProps {
  steps: WizardStep[];
  children: ReactNode[];
  onComplete: () => void;
  onCancel?: () => void;
  showStepIndicator?: boolean;
}

export default function Wizard({ steps, children, onComplete, onCancel, showStepIndicator = true }: WizardProps) {
  const [activeStep, setActiveStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const isLastStep = activeStep === steps.length - 1;

  const handleNext = () => {
    setCompletedSteps(prev => new Set(prev).add(activeStep));
    if (isLastStep) onComplete();
    else setActiveStep(prev => prev + 1);
  };

  return (
    <Box>
      {showStepIndicator && (
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {steps.map((step, index) => (
            <Step key={step.id} completed={completedSteps.has(index)}>
              <StepLabel optional={step.description ? <Typography variant="caption">{step.description}</Typography> : null}>
                {step.label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      <AnimatePresence mode="wait">
        <motion.div key={activeStep} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          <Box sx={{ minHeight: 300 }}>{children[activeStep]}</Box>
        </motion.div>
      </AnimatePresence>

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 4 }}>
        {onCancel && <Button onClick={onCancel} color="inherit">Zrušit</Button>}
        {activeStep > 0 && <Button onClick={() => setActiveStep(p => p - 1)}>Zpět</Button>}
        <Button variant="contained" onClick={handleNext}>{isLastStep ? 'Dokončit' : 'Další'}</Button>
      </Box>
    </Box>
  );
}
