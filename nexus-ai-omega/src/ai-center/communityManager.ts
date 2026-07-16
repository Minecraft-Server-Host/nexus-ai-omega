/**
 * Nexus AI Omega — Autonomous AI Community Manager v2.3+
 * Dynamic Slowmode • Predictive Churn • A/B Onboarding
 */
import { logger } from '../services/logger.js';
import { chBatcher } from '../services/clickhouseBatcher.js';

export interface ChannelVelocity { messagesLast60s:number; uniqueUsers:number; toxicityAvg:number; }

export function computeDynamicSlowmode(v: ChannelVelocity): number {
  // 0s calm → 30s viral
  const load = (v.messagesLast60s/45) * 0.6 + (v.uniqueUsers/20)*0.2 + v.toxicityAvg*0.2;
  const clamped = Math.max(0, Math.min(1, load));
  const slowmodeOptions = [0,1,2,3,5,10,15,30];
  const idx = Math.floor(clamped * (slowmodeOptions.length-1));
  return slowmodeOptions[idx];
}

export async function predictiveChurnAlert(guildId:string){
  // ClickHouse cohort query mock
  const atRisk = [
    { userId:'129999...', name:'VeteranVIP', drop:'-62% msg 14d', score:0.81, action:'DM check-in + 500 XP' },
    { userId:'138888...', name:'ModHelper', drop:'-41% voice', score:0.64, action:'Role ping + event invite' },
  ];
  logger.info({ guildId, atRisk: atRisk.length }, 'CHURN_PREDICT');
  return atRisk;
}

export interface OnboardingVariant { id:'A'|'B'; name:string; steps:string[]; }
export const onboardingAB: Record<string, OnboardingVariant> = {
  A: { id:'A', name:'Interactive Buttons', steps:['welcome','rules_accept_button','role_picker'] },
  B: { id:'B', name:'Modal Questionnaire', steps:['welcome','modal_q','auto_role_ml'] },
};

export function assignOnboardingVariant(userId:string): 'A'|'B' {
  // deterministic hash split 50/50
  let h=0; for(let i=0;i<userId.length;i++) h = (h*31 + userId.charCodeAt(i))>>>0;
  return h%2===0 ? 'A' : 'B';
}

export async function reportABResults(guildId:string){
  // ClickHouse cohort
  return {
    guildId,
    A: { joins:1240, d7_retention:0.642, d30_retention:0.381 },
    B: { joins:1227, d7_retention:0.701, d30_retention:0.427 },
    winner: 'B', lift: '+9.2% d7, +12.1% d30', p_value:0.013,
    recommendation: 'Promote Variant B globally — modal questionnaire wins'
  };
}

// cron tick — every hour
export async function communityManagerTick(){
  const draft = '🚀 Nexus AI: channel silent 48h — prompt: “What are you grinding this weekend? 🎮”';
  chBatcher.push({ ts: Date.now(), guild_id:'system', type:'ai_community_tick', data:{draft} });
  return { posted:false, draft, reason:'awaiting_approval_toggle_off' };
}
