/* /web — the landing page, at the level of artboard V-Web2. */

import { Hero } from '../landing/Hero';
import { ServiceBlocks } from '../landing/ServiceBlocks';
import { MeasureStage } from '../landing/MeasureStage';
import { BookingSection, ClubSection, PartnersJoinSection, PhilosophySection, StepsSection } from '../landing/sections';
import { PartnerMarquee } from '../landing/PartnerMarquee';

export default function LandingPage() {
  return (
    <>
      {/* Hero, what we measure (the pinned sequence), the services with their prices, booking, how it goes. */}
      <Hero />
      <MeasureStage />
      <ServiceBlocks />
      <BookingSection />
      <StepsSection />
      <ClubSection />
      <PartnerMarquee />
      <PartnersJoinSection />
      <PhilosophySection />
    </>
  );
}
