/* /vybaveni — the devices of the clinic, as the live site describes them: anthropometry (InBody 770 +
   SECA), vacuum ECG, Lode Excalibur Sport, PureFlow spirometry, spiroergometry, and the technology of
   the diagnostics (HumanTrak, ForceDecks, Cortex 21). Every sentence is a slot, every photo a grey
   placeholder with a caption until Matko sends files (src/site/slots/vybaveni.ts, same device list). */

import { Box } from '@mui/material';
import { MediaSlot } from '../../site/MediaSlot';
import { SlotText, useSlotText } from '../../site/SlotText';
import { ArrowLink } from '../ui';
import { FONT_HEAD, MQ, W } from '../tokens';
import { CARD_SX, PageSection, Paras } from './services/blocks';
import { ServiceHero } from './services/ServiceHero';
import { MAIN_DEVICES, TECH_DEVICES, VYBAVENI_TECH_CLOSING } from './services/content/vybaveni';
import type { DeviceDef } from './services/content/vybaveni';

function Device({ device, flip }: { device: DeviceDef; flip: boolean }) {
  const prefix = `vybaveni.dev.${device.id}`;
  return (
    <Box
      component="article"
      sx={[
        {
          display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: { xs: '20px', md: '36px' }, p: { xs: '20px', md: '28px' }, alignItems: 'start',
          [MQ.desktop]: { gridTemplateColumns: flip ? 'minmax(0, 1fr) 420px' : '420px minmax(0, 1fr)' },
        },
        CARD_SX as object,
        { borderRadius: '18px', '@media (hover: hover)': { '&:hover': { transform: 'none' } } },
      ]}
    >
      <MediaSlot
        slotKey={`${prefix}.photo`}
        sizes="(max-width: 1279px) 100vw, 420px"
        sx={{ borderRadius: '14px', aspectRatio: '4 / 3', minHeight: 0, [MQ.desktop]: { order: flip ? 2 : 0 } }}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: '14px', minWidth: 0 }}>
        <SlotText slotKey={`${prefix}.title`} as="h3" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 800, fontSize: { xs: 24, md: 28 }, letterSpacing: '-0.025em', lineHeight: 1.15 }} />
        <Paras prefix={prefix} count={device.intro.length} />
        {device.sub !== undefined && <SlotText slotKey={`${prefix}.sub`} as="p" sx={{ m: 0, fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: W.muted }} />}
        {device.groups.map((group, groupIndex) => {
          const groupPrefix = `${prefix}.g${groupIndex + 1}`;
          return (
            <Box key={groupIndex} sx={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {group.heading !== undefined && <SlotText slotKey={`${groupPrefix}.heading`} as="h4" sx={{ m: 0, fontFamily: FONT_HEAD, fontWeight: 700, fontSize: 17, lineHeight: 1.3 }} />}
              <Box component="ul" sx={{ m: 0, pl: '20px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: 15, lineHeight: 1.6, color: W.body }}>
                {group.items.map((_, itemIndex) => (
                  <li key={itemIndex}>
                    <SlotText slotKey={`${groupPrefix}.${itemIndex + 1}.title`} sx={{ fontWeight: 700, color: W.text }} />
                    {': '}
                    <SlotText slotKey={`${groupPrefix}.${itemIndex + 1}.text`} />
                  </li>
                ))}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function VybaveniPage() {
  const toPrices = useSlotText('sluzby.shared.cta.prices');
  return (
    <>
      <ServiceHero page="vybaveni" priceButton />

      <PageSection title="vybaveni.main.title">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {MAIN_DEVICES.map((device, index) => (
            <Device key={device.id} device={device} flip={index % 2 === 1} />
          ))}
        </Box>
      </PageSection>

      <PageSection title="vybaveni.tech.title" tone="warm">
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
          {TECH_DEVICES.map((device, index) => (
            <Device key={device.id} device={device} flip={index % 2 === 1} />
          ))}
        </Box>
        <Paras prefix="vybaveni.tech.closing" count={VYBAVENI_TECH_CLOSING.length} />
        <ArrowLink to="/cenik">{toPrices}</ArrowLink>
      </PageSection>
    </>
  );
}
