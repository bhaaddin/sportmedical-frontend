/*
 * Můj účet → Vzhled a rozhraní.
 *
 * Four real themes and two workspaces, each with its label and one sentence
 * of help from the server's own catalogue. A choice is saved with
 * `PUT /api/v1/account/preferences` the moment it is made, stored on the
 * account, and applied here straight away through the preferences store -
 * so the screen changes as the radio is clicked, and it is still that way
 * on the next browser.
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Card,
  CardContent,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import { Palette } from '@mui/icons-material';
import {
  readAccountPreferences,
  saveAccountPreferences,
  type AccountPreferencesResponse,
  type PreferenceChoice,
} from '../../api/accountPreferences';
import { savePreferences, usePreferences } from '../../auth/preferences';
import { THEME_COLORS, isThemeKey } from '../../theme';
import { PREFERENCES_TEXT } from './preferencesText';

export function AccountPreferencesCard() {
  const current = usePreferences();
  const [catalogue, setCatalogue] = useState<AccountPreferencesResponse | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState<'theme' | 'workspace' | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    readAccountPreferences()
      .then((response) => {
        if (!alive) return;
        setCatalogue(response);
        /* The server is the truth; a browser that missed the sign-in answer catches up here. */
        savePreferences(response.preferences);
      })
      .catch(() => {
        if (alive) setLoadError(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const choose = async (field: 'theme' | 'workspace', key: string) => {
    if (saving) return;
    setSaving(field);
    setSaveError(false);
    try {
      const response = await saveAccountPreferences({ [field]: key });
      savePreferences(response.preferences);
      setCatalogue(response);
      setSavedAt(Date.now());
    } catch {
      setSaveError(true);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Card variant="outlined" sx={{ borderRadius: 2, mb: 2 }}>
      <CardContent>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <Palette sx={{ color: 'primary.main' }} />
          <Typography sx={{ fontWeight: 700 }}>{PREFERENCES_TEXT.title}</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {PREFERENCES_TEXT.help}
        </Typography>

        {loadError ? <Alert severity="warning">{PREFERENCES_TEXT.loadFailed}</Alert> : null}
        {saveError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {PREFERENCES_TEXT.saveFailed}
          </Alert>
        ) : null}

        {!catalogue && !loadError ? (
          <Stack spacing={1}>
            <Skeleton variant="rounded" height={48} />
            <Skeleton variant="rounded" height={48} />
          </Stack>
        ) : null}

        {catalogue ? (
          <Stack spacing={3}>
            <ChoiceGroup
              label={PREFERENCES_TEXT.theme}
              name="theme"
              choices={catalogue.themes}
              value={current.theme}
              disabled={saving !== null}
              onChoose={(key) => void choose('theme', key)}
              swatch
            />
            <ChoiceGroup
              label={PREFERENCES_TEXT.workspace}
              name="workspace"
              choices={catalogue.workspaces}
              value={current.workspace}
              disabled={saving !== null}
              onChoose={(key) => void choose('workspace', key)}
            />
            {savedAt !== null && !saveError ? (
              <Typography variant="caption" sx={{ color: 'success.main' }} role="status">
                {PREFERENCES_TEXT.saved}
              </Typography>
            ) : null}
          </Stack>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ChoiceGroup({
  label,
  name,
  choices,
  value,
  disabled,
  onChoose,
  swatch = false,
}: {
  label: string;
  name: string;
  choices: PreferenceChoice[];
  value: string;
  disabled: boolean;
  onChoose: (key: string) => void;
  swatch?: boolean;
}) {
  return (
    <FormControl component="fieldset" disabled={disabled} sx={{ width: '100%' }}>
      <FormLabel component="legend" sx={{ fontWeight: 600, mb: 0.5 }}>
        {label}
      </FormLabel>
      <RadioGroup name={name} value={value} onChange={(_, next) => onChoose(next)}>
        {choices.map((choice) => (
          <FormControlLabel
            key={choice.key}
            value={choice.key}
            control={<Radio />}
            sx={{ alignItems: 'flex-start', mb: 0.5, mr: 0 }}
            label={
              <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', pt: 0.75 }}>
                {swatch && isThemeKey(choice.key) ? <Swatch themeKey={choice.key} /> : null}
                <Box>
                  <Typography sx={{ fontWeight: 600, lineHeight: 1.3 }}>{choice.label}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    {choice.help}
                  </Typography>
                </Box>
              </Stack>
            }
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

/** The theme's paper, primary and text in one small tile, so the words are not the only preview. */
function Swatch({ themeKey }: { themeKey: keyof typeof THEME_COLORS }) {
  const c = THEME_COLORS[themeKey];
  return (
    <Box
      aria-hidden
      sx={{
        width: 44,
        height: 30,
        flexShrink: 0,
        borderRadius: 1,
        border: '1px solid',
        borderColor: c.divider,
        backgroundColor: c.background.paper,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 0.5,
        mt: 0.25,
      }}
    >
      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: c.primary.main }} />
      <Box sx={{ width: 12, height: 12, borderRadius: '50%', backgroundColor: c.text.primary }} />
    </Box>
  );
}

export default AccountPreferencesCard;
