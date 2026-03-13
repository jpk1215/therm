import styles from "./RamadanFundraiserThermometer.module.css";
import { formatMoney } from "../utils/formatMoney";

const ASSET_BASE = "/ramadan_full_asset_pack";

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function toSafeAmount(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function RamadanFundraiserThermometer({
  title = "Ramadan Fundraiser",
  currentAmount = 1750000,
  goalAmount = 3000000,
  milestones = [3000000, 2500000, 2000000, 1500000, 1000000],
  ctaText = "Donate Generously"
}) {
  const safeGoal = Math.max(1, toSafeAmount(goalAmount, 1));
  const safeCurrent = clamp(toSafeAmount(currentAmount, 0), 0, safeGoal);
  const fillPercent = clamp(safeCurrent / safeGoal, 0, 1);
  const sortedMilestones = [...milestones].sort((a, b) => b - a);

  return (
    <section
      className={styles.artboard}
      aria-label={`${title} thermometer`}
      role="img"
    >
      {/* Base ambiance and frame layers */}
      <img className={`${styles.asset} ${styles.texture}`} src={`${ASSET_BASE}/ivory-speckle-overlay.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.skyline}`} src={`${ASSET_BASE}/mosque-skyline.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.archFrame}`} src={`${ASSET_BASE}/arch-frame-ornate.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.trimPattern}`} src={`${ASSET_BASE}/islamic-border-pattern.svg`} alt="" aria-hidden="true" />

      {/* Upper decorative details */}
      <img className={`${styles.asset} ${styles.topLanternLeft}`} src={`${ASSET_BASE}/lantern-large-a.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.topLanternRight}`} src={`${ASSET_BASE}/lantern-large-b.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.sparkleA}`} src={`${ASSET_BASE}/sparkle-8pt.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.sparkleB}`} src={`${ASSET_BASE}/sparkle-4pt.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.sparkleDot}`} src={`${ASSET_BASE}/sparkle-dot.svg`} alt="" aria-hidden="true" />

      <header className={styles.titleWrap}>
        <h2 className={styles.title}>{title}</h2>
      </header>

      <img className={`${styles.asset} ${styles.topDivider}`} src={`${ASSET_BASE}/ornament-divider-small.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.crescent}`} src={`${ASSET_BASE}/crescent-topper.svg`} alt="" aria-hidden="true" />

      <aside className={styles.milestonePanel}>
        {sortedMilestones.map((amount) => (
          <div key={amount} className={styles.milestoneRow}>
            <img className={`${styles.asset} ${styles.milestoneLine}`} src={`${ASSET_BASE}/milestone-line.svg`} alt="" aria-hidden="true" />
            <span className={styles.milestoneValue}>{formatMoney(amount)}</span>
          </div>
        ))}
        <div className={styles.goalLabel}>GOAL</div>
      </aside>

      <aside className={styles.amountPlaque}>
        <img className={styles.amountPanel} src={`${ASSET_BASE}/amount-plaque-panel.svg`} alt="" aria-hidden="true" />
        <img className={`${styles.asset} ${styles.amountFrame}`} src={`${ASSET_BASE}/amount-plaque-frame.svg`} alt="" aria-hidden="true" />
        <div className={styles.amountPlaqueText}>
          <span className={styles.amountLabel}>Current Amount</span>
          <span className={styles.amountValue}>{formatMoney(safeCurrent)}</span>
        </div>
      </aside>

      {/* Thermometer stack: masked fill under shell + synced bulb glow */}
      <div className={styles.thermometerArea}>
        <div className={styles.fillClip}>
          <div className={styles.tubeFill} style={{ height: `${fillPercent * 100}%` }} />
        </div>
        <img className={styles.tubeShell} src={`${ASSET_BASE}/thermometer-shell.svg`} alt="" aria-hidden="true" />
        <div className={styles.bulbFill} />
        <img className={styles.bulbAsset} src={`${ASSET_BASE}/thermometer-bulb.svg`} alt="" aria-hidden="true" />
        <img className={styles.bulbCradle} src={`${ASSET_BASE}/bulb-cradle.svg`} alt="" aria-hidden="true" />
      </div>

      <img className={`${styles.asset} ${styles.flourishLeft}`} src={`${ASSET_BASE}/flourish-left.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.flourishRight}`} src={`${ASSET_BASE}/flourish-right.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.smallLanternLeft}`} src={`${ASSET_BASE}/lantern-small.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.smallLanternRight}`} src={`${ASSET_BASE}/lantern-small.svg`} alt="" aria-hidden="true" />

      <footer className={styles.ctaWrap}>
        <img className={styles.ctaPlaque} src={`${ASSET_BASE}/cta-plaque.svg`} alt="" aria-hidden="true" />
        <p className={styles.ctaText}>{ctaText}</p>
      </footer>

      <img className={`${styles.asset} ${styles.cornerLeft}`} src={`${ASSET_BASE}/corner-floral-left.svg`} alt="" aria-hidden="true" />
      <img className={`${styles.asset} ${styles.cornerRight}`} src={`${ASSET_BASE}/corner-floral-right.svg`} alt="" aria-hidden="true" />
    </section>
  );
}
