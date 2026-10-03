/* /web — the landing page, at the level of artboard V-Web2. */

import { Hero } from '../landing/Hero';
import { ServiceBlocks } from '../landing/ServiceBlocks';
import { ClubSection, EquipmentSection, PhilosophySection, StepsSection } from '../landing/sections';
import { PartnerMarquee } from '../landing/PartnerMarquee';

export default function LandingPage() {
  return (
    <>
      <Hero />
      <ServiceBlocks />
      <EquipmentSection />
      <StepsSection />
      <ClubSection />
      <PartnerMarquee />
      <PhilosophySection />
    </>
  );
}
