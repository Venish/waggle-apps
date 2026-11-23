import { config } from "dotenv";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb, getPool } from "./client";
import * as s from "./schema/index";

const REPO_ROOT = path.resolve(process.cwd(), "../..");
config({ path: path.resolve(REPO_ROOT, ".env") });

function resolveSeedUploadRoot(): string {
  const raw = process.env.UPLOAD_DIR || "./uploads";
  return path.isAbsolute(raw) ? path.resolve(raw) : path.resolve(REPO_ROOT, raw);
}

function copyBreedAssetToUpload(
  breedFile: string,
  category: "products" | "editor" | "reviews",
  targetFilename: string,
): string {
  const baseUrl = (process.env.UPLOAD_PUBLIC_BASE_URL || "/api/uploads").replace(/\/+$/, "");
  const ym = "202611";
  const srcPath = path.resolve(REPO_ROOT, "apps/web/public/images/breeds", breedFile);
  const destDir = path.join(resolveSeedUploadRoot(), category, ym);
  const destPath = path.join(destDir, targetFilename);
  fs.mkdirSync(destDir, { recursive: true });
  if (fs.existsSync(srcPath) && !fs.existsSync(destPath)) {
    fs.copyFileSync(srcPath, destPath);
  }
  return `${baseUrl}/${category}/${ym}/${targetFilename}`;
}

function hashPassword(plain: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(plain, salt, 64).toString("hex");
  return `scrypt$${salt}$${derived}`;
}

async function seed() {
  const db = getDb();
  console.log("[SEED] Waggle PostgreSQL 18 초기 시드 적재 시작...");

  // 1. Policy Configs (GM-011 Strict DB Single Source — 코드 Fallback 0%)
  const defaultPolicies: Array<{ key: string; value: unknown; description: string }> = [
    { key: "point.watch", value: 30, description: "레슨 영상 95% 시청 완료 최초 적립 포인트" },
    { key: "point.practice", value: 20, description: "레슨 실습 자가체크 완료 최초 적립 포인트" },
    { key: "point.quiz", value: 50, description: "레슨 퀴즈 최초 통과 적립 포인트" },
    { key: "point.bonus.unit", value: 100, description: "유닛 완주 보너스 포인트" },
    { key: "point.bonus.course", value: 300, description: "코스 완주 보너스 포인트" },
    { key: "point.daily_earn_cap", value: 500, description: "일일 교육 적립 포인트 상한" },
    { key: "point.expire_days", value: 365, description: "포인트 유효기간 (일, FIFO 소멸)" },
    { key: "watch.complete_percent", value: 95, description: "영상 시청 완료 판정 비율 (%)" },
    { key: "quiz.pass_percent", value: 80, description: "퀴즈 기본 통과 기준 (%)" },
    { key: "level_test.pass_score_pct", value: 80, description: "레벨테스트 통과 기준 (%)" },
    {
      key: "grade.tiers",
      value: [
        { grade: 1, title: "유치원 1학년", minLessons: 0 },
        { grade: 2, title: "초등 2학년", minLessons: 3 },
        { grade: 3, title: "중등 3학년", minLessons: 8 },
        { grade: 4, title: "고등 4학년", minLessons: 15 },
        { grade: 5, title: "우등 5학년", minLessons: 25 },
      ],
      description: "강아지 1~5학년 승급 기준 (누적 완료 레슨 수 · 학년명)",
    },
    { key: "level_test.bonus_enabled", value: false, description: "레벨테스트 보너스 지급 여부" },
    { key: "level_test.bonus_points", value: 0, description: "레벨테스트 통과 보너스 포인트" },
    { key: "inquiry.price", value: 1500, description: "훈련사 비동기 영상 Q&A 1회 차감 포인트" },
    { key: "inquiry.sla_hours", value: 48, description: "훈련사 Q&A 답변 SLA 시간 (초과 시 자동 환불)" },
    { key: "inquiry.assignment_mode", value: "MANUAL_RECOMMEND", description: "Q&A 배정 방식 (MANUAL_RECOMMEND | AUTO)" },
    { key: "settlement.commission_rate", value: 0.7, description: "훈련사 월 정산 비율 (0~1)" },
    { key: "shop.review.text_reward_point", value: 100, description: "실물 상품 텍스트 후기 작성 적립 포인트 (0이면 미지급)" },
    { key: "shop.review.photo_reward_point", value: 300, description: "실물 상품 포토 후기(사진 1장 이상) 작성 적립 포인트" },
    { key: "shop.review.min_length", value: 20, description: "상품 후기 최소 작성 글자수" },
    { key: "shop.review.max_length", value: 500, description: "상품 후기 최대 작성 글자수" },
    {
      key: "recharge.packages",
      value: [
        { code: "PKG_3000", label: "스타터 3,000P", pointAmount: 3000, webPrice: 3000, iapPrice: 3600 },
        { code: "PKG_10000", label: "베이직 10,000P", pointAmount: 10000, webPrice: 10000, iapPrice: 12000 },
        { code: "PKG_30000", label: "프로 30,000P (+1,500P)", pointAmount: 31500, webPrice: 30000, iapPrice: 36000 },
      ],
      description: "충전 패키지 (웹 PortOne / 앱 IAP 채널별 차등 가격)",
    },
  ];

  for (const p of defaultPolicies) {
    const existing = await db
      .select()
      .from(s.policyConfigs)
      .where(and(eq(s.policyConfigs.key, p.key), eq(s.policyConfigs.isDeleted, false)))
      .limit(1);
    if (existing.length === 0) {
      const [inserted] = await db
        .insert(s.policyConfigs)
        .values({ key: p.key, value: p.value, description: p.description })
        .returning();
      if (inserted) {
        await db.insert(s.policyConfigHistories).values({
          policyConfigId: inserted.id,
          key: p.key,
          oldValue: null,
          newValue: p.value,
        });
      }
    }
  }

  // 2. Admins (운영자 + 훈련사 계정)
  async function ensureAdmin(email: string, name: string, phone: string, role: "ADMIN" | "TRAINER", plainPw: string) {
    const existing = await db
      .select()
      .from(s.admins)
      .where(and(eq(s.admins.email, email), eq(s.admins.isDeleted, false)))
      .limit(1);
    if (existing[0]) return existing[0];
    const [created] = await db
      .insert(s.admins)
      .values({ email, name, phone, role, passwordHash: hashPassword(plainPw), status: "ACTIVE" })
      .returning();
    return created!;
  }

  const adminUser = await ensureAdmin("admin@waggle.kr", "김와글 운영자", "010-1000-0001", "ADMIN", "Admin1234!");
  const trainerAdmin = await ensureAdmin("trainer@waggle.kr", "박훈련 수석훈련사", "010-2000-0002", "TRAINER", "Trainer1234!");

  // 3. Breeds (견종 마스터 — 국내 등록 상위 40종 풀셋: 소형 19 · 중형 11 · 대형 10)
  const breedSeeds: Array<{ code: string; nameKo: string; nameEn: string; defaultSize: "SMALL" | "MEDIUM" | "LARGE" }> = [
    // 소형견 (19)
    { code: "POODLE_TOY", nameKo: "토이 푸들", nameEn: "Toy Poodle", defaultSize: "SMALL" },
    { code: "MALTESE", nameKo: "말티즈", nameEn: "Maltese", defaultSize: "SMALL" },
    { code: "BICHON", nameKo: "비숑 프리제", nameEn: "Bichon Frise", defaultSize: "SMALL" },
    { code: "POMERANIAN", nameKo: "포메라니안", nameEn: "Pomeranian", defaultSize: "SMALL" },
    { code: "MALTIPOO", nameKo: "말티푸", nameEn: "Maltipoo", defaultSize: "SMALL" },
    { code: "CHIHUAHUA", nameKo: "치와와", nameEn: "Chihuahua", defaultSize: "SMALL" },
    { code: "SHIH_TZU", nameKo: "시츄", nameEn: "Shih Tzu", defaultSize: "SMALL" },
    { code: "YORKSHIRE_TERRIER", nameKo: "요크셔 테리어", nameEn: "Yorkshire Terrier", defaultSize: "SMALL" },
    { code: "DACHSHUND", nameKo: "닥스훈트", nameEn: "Dachshund", defaultSize: "SMALL" },
    { code: "MINIATURE_PINSCHER", nameKo: "미니핀", nameEn: "Miniature Pinscher", defaultSize: "SMALL" },
    { code: "MINIATURE_SCHNAUZER", nameKo: "미니어처 슈나우저", nameEn: "Miniature Schnauzer", defaultSize: "SMALL" },
    { code: "PAPILLON", nameKo: "파피용", nameEn: "Papillon", defaultSize: "SMALL" },
    { code: "PEKINGESE", nameKo: "페키니즈", nameEn: "Pekingese", defaultSize: "SMALL" },
    { code: "PUG", nameKo: "퍼그", nameEn: "Pug", defaultSize: "SMALL" },
    { code: "ITALIAN_GREYHOUND", nameKo: "이탈리안 그레이하운드", nameEn: "Italian Greyhound", defaultSize: "SMALL" },
    { code: "JACK_RUSSELL_TERRIER", nameKo: "잭 러셀 테리어", nameEn: "Jack Russell Terrier", defaultSize: "SMALL" },
    { code: "CAVALIER_KING_CHARLES", nameKo: "캐벌리어 킹 찰스 스패니얼", nameEn: "Cavalier King Charles Spaniel", defaultSize: "SMALL" },
    { code: "COTON_DE_TULEAR", nameKo: "코통 드 툴레아", nameEn: "Coton de Tulear", defaultSize: "SMALL" },
    { code: "MIXED_SMALL", nameKo: "믹스견 (소형)", nameEn: "Mixed Small", defaultSize: "SMALL" },

    // 중형견 (11)
    { code: "WELSH_CORGI", nameKo: "웰시 코기", nameEn: "Welsh Corgi", defaultSize: "MEDIUM" },
    { code: "SHIBA", nameKo: "시바 이누", nameEn: "Shiba Inu", defaultSize: "MEDIUM" },
    { code: "BORDER_COLLIE", nameKo: "보더 콜리", nameEn: "Border Collie", defaultSize: "MEDIUM" },
    { code: "JINDO", nameKo: "진돗개", nameEn: "Korean Jindo", defaultSize: "MEDIUM" },
    { code: "FRENCH_BULLDOG", nameKo: "프렌치 불독", nameEn: "French Bulldog", defaultSize: "MEDIUM" },
    { code: "BEAGLE", nameKo: "비글", nameEn: "Beagle", defaultSize: "MEDIUM" },
    { code: "COCKER_SPANIEL", nameKo: "코커 스패니얼", nameEn: "American Cocker Spaniel", defaultSize: "MEDIUM" },
    { code: "JAPANESE_SPITZ", nameKo: "재패니즈 스피츠", nameEn: "Japanese Spitz", defaultSize: "MEDIUM" },
    { code: "SHETLAND_SHEEPDOG", nameKo: "셔틀랜드 쉽독", nameEn: "Shetland Sheepdog", defaultSize: "MEDIUM" },
    { code: "SAPSALI", nameKo: "삽살개", nameEn: "Sapsali", defaultSize: "MEDIUM" },
    { code: "MIXED_MEDIUM", nameKo: "믹스견 (중형)", nameEn: "Mixed Medium", defaultSize: "MEDIUM" },

    // 대형견 (10)
    { code: "GOLDEN_RETRIEVER", nameKo: "골든 리트리버", nameEn: "Golden Retriever", defaultSize: "LARGE" },
    { code: "LABRADOR_RETRIEVER", nameKo: "래브라도 리트리버", nameEn: "Labrador Retriever", defaultSize: "LARGE" },
    { code: "SAMOYED", nameKo: "사모예드", nameEn: "Samoyed", defaultSize: "LARGE" },
    { code: "SIBERIAN_HUSKY", nameKo: "시베리안 허스키", nameEn: "Siberian Husky", defaultSize: "LARGE" },
    { code: "ALASKAN_MALAMUTE", nameKo: "알래스칸 말라뮤트", nameEn: "Alaskan Malamute", defaultSize: "LARGE" },
    { code: "POODLE_STANDARD", nameKo: "스탠다드 푸들", nameEn: "Standard Poodle", defaultSize: "LARGE" },
    { code: "GERMAN_SHEPHERD", nameKo: "저먼 셰퍼드", nameEn: "German Shepherd", defaultSize: "LARGE" },
    { code: "DOBERMAN", nameKo: "도베르만", nameEn: "Dobermann", defaultSize: "LARGE" },
    { code: "BERNESE_MOUNTAIN_DOG", nameKo: "버니즈 마운틴 독", nameEn: "Bernese Mountain Dog", defaultSize: "LARGE" },
    { code: "MIXED_LARGE", nameKo: "믹스견 (대형)", nameEn: "Mixed Large", defaultSize: "LARGE" },
  ];

  const breedMap = new Map<string, number>();
  for (const b of breedSeeds) {
    const existing = await db
      .select()
      .from(s.breeds)
      .where(and(eq(s.breeds.code, b.code), eq(s.breeds.isDeleted, false)))
      .limit(1);
    if (existing[0]) {
      breedMap.set(b.code, existing[0].id);
    } else {
      const [created] = await db.insert(s.breeds).values(b).returning();
      if (created) breedMap.set(b.code, created.id);
    }
  }

  // 4. Common Codes (접종 종류 VACCINE_TYPE)
  const vaccineSeeds = [
    { code: "DHPPL", codeKorName: "종합백신 (DHPPL)", description: "홍역·간염·파보·파라인플루엔자·렙토스피라", sortOrder: 1, extra: { intervalDays: 365, isMandatory: true } },
    { code: "CORONA", codeKorName: "코로나 장염", description: "코로나 바이러스성 장염 예방", sortOrder: 2, extra: { intervalDays: 365, isMandatory: false } },
    { code: "KENNEL_COUGH", codeKorName: "켄넬코프", description: "전염성 기관지염 예방", sortOrder: 3, extra: { intervalDays: 365, isMandatory: true } },
    { code: "RABIES", codeKorName: "광견병", description: "법정 필수 예방접종", sortOrder: 4, extra: { intervalDays: 365, isMandatory: true } },
    { code: "HEARTWORM", codeKorName: "심장사상충", description: "월 1회 정기 예방", sortOrder: 5, extra: { intervalDays: 30, isMandatory: true } },
  ];

  let firstVaccineId = 0;
  for (const v of vaccineSeeds) {
    const existing = await db
      .select()
      .from(s.commonCodes)
      .where(and(eq(s.commonCodes.codeGroup, "VACCINE_TYPE"), eq(s.commonCodes.code, v.code), eq(s.commonCodes.isDeleted, false)))
      .limit(1);
    if (existing[0]) {
      if (!firstVaccineId) firstVaccineId = existing[0].id;
    } else {
      const [created] = await db
        .insert(s.commonCodes)
        .values({ codeGroup: "VACCINE_TYPE", ...v })
        .returning();
      if (created && !firstVaccineId) firstVaccineId = created.id;
    }
  }

  // 5. Tags (매칭 + 훈련사 분야 태그)
  const tagSeeds: Array<{ code: string; name: string; category: typeof s.tagCategoryEnum.enumValues[number] }> = [
    { code: "puppy", name: "퍼피 (6개월 이하)", category: "AGE" },
    { code: "adolescent", name: "청소년견 (7~12개월)", category: "AGE" },
    { code: "adult", name: "성견 (1~7세)", category: "AGE" },
    { code: "senior", name: "시니어견 (7세 이상)", category: "AGE" },
    { code: "exp_none", name: "훈련 경험 없음", category: "EXPERIENCE" },
    { code: "exp_self", name: "유튜브/독학 경험", category: "EXPERIENCE" },
    { code: "prob_bark", name: "짖음 교정", category: "PROBLEM" },
    { code: "prob_sep", name: "분리불안", category: "PROBLEM" },
    { code: "prob_potty", name: "배변 훈련", category: "PROBLEM" },
    { code: "prob_leash", name: "산책 리드줄 당김", category: "PROBLEM" },
    { code: "prob_bite", name: "입질/물기", category: "PROBLEM" },
    { code: "goal_basic", name: "기초 매너 완성", category: "GOAL" },
    { code: "goal_fix", name: "문제행동 교정", category: "GOAL" },
    { code: "env_apt", name: "아파트/다세대", category: "ENV" },
    { code: "soc_excite", name: "외부 자극 흥분", category: "SOCIAL" },
    { code: "spec_behavior", name: "행동교정 전문", category: "SPECIALTY" },
  ];

  const tagMap = new Map<string, number>();
  for (const t of tagSeeds) {
    const existing = await db
      .select()
      .from(s.tags)
      .where(and(eq(s.tags.code, t.code), eq(s.tags.isDeleted, false)))
      .limit(1);
    if (existing[0]) {
      tagMap.set(t.code, existing[0].id);
    } else {
      const [created] = await db.insert(s.tags).values(t).returning();
      if (created) tagMap.set(t.code, created.id);
    }
  }

  // 6. Survey Questions (7문항 온보딩 설문 + 선택지 + AnswerTag)
  const surveyData: Array<{
    code: string;
    text: string;
    allowMultiple: boolean;
    answers: Array<{ text: string; tags: Array<{ code: string; weight: number }> }>;
  }> = [
    {
      code: "Q1_EXP",
      text: "보호자님의 반려견 교육 경험은 어느 정도인가요?",
      allowMultiple: false,
      answers: [
        { text: "처음 키워서 기초부터 배워야 해요", tags: [{ code: "exp_none", weight: 3 }, { code: "goal_basic", weight: 2 }] },
        { text: "유튜브나 책으로 조금 시도해 봤어요", tags: [{ code: "exp_self", weight: 2 }] },
        { text: "훈련소나 방문 교육을 받아본 적 있어요", tags: [{ code: "goal_fix", weight: 2 }] },
      ],
    },
    {
      code: "Q2_PROBLEM",
      text: "가장 고민되는 행동이 있다면 모두 골라주세요.",
      allowMultiple: true,
      answers: [
        { text: "현관 벨소리나 외부 소리에 짖어요", tags: [{ code: "prob_bark", weight: 4 }, { code: "goal_fix", weight: 2 }] },
        { text: "산책할 때 리드줄을 너무 세게 당겨요", tags: [{ code: "prob_leash", weight: 4 }] },
        { text: "배변 패드를 자꾸 빗나가요", tags: [{ code: "prob_potty", weight: 4 }] },
        { text: "혼자 두면 불안해하고 낑낑거려요", tags: [{ code: "prob_sep", weight: 4 }] },
      ],
    },
    {
      code: "Q3_GOAL",
      text: "와글 교육으로 가장 먼저 이루고 싶은 목표는?",
      allowMultiple: false,
      answers: [
        { text: "앉아·기다려 등 기본 생활 매너 완성", tags: [{ code: "goal_basic", weight: 4 }] },
        { text: "짖음·당김 등 불편한 행동 교정", tags: [{ code: "goal_fix", weight: 4 }] },
        { text: "강아지와 더 깊은 교감과 놀이 루틴", tags: [{ code: "goal_basic", weight: 2 }] },
      ],
    },
    {
      code: "Q4_TIME",
      text: "하루에 투자할 수 있는 교육 시간은?",
      allowMultiple: false,
      answers: [
        { text: "하루 5분 (레슨 1개 가볍게)", tags: [{ code: "exp_none", weight: 1 }] },
        { text: "하루 10~15분 (레슨 2개 꾸준히)", tags: [{ code: "goal_basic", weight: 1 }] },
        { text: "하루 20분 이상 집중 훈련", tags: [{ code: "goal_fix", weight: 1 }] },
      ],
    },
    {
      code: "Q5_ENV",
      text: "주로 생활하는 주거 환경은 어떤가요?",
      allowMultiple: false,
      answers: [
        { text: "아파트 · 빌라 · 오피스텔", tags: [{ code: "env_apt", weight: 3 }, { code: "prob_bark", weight: 1 }] },
        { text: "단독주택 · 마당 있음", tags: [{ code: "prob_leash", weight: 1 }] },
      ],
    },
    {
      code: "Q6_SOCIAL",
      text: "산책 시 다른 강아지나 사람을 만났을 때 반응은?",
      allowMultiple: false,
      answers: [
        { text: "반갑게 다가가거나 차분하게 지나가요", tags: [{ code: "goal_basic", weight: 1 }] },
        { text: "지나치게 흥분해서 뛰거나 짖어요", tags: [{ code: "soc_excite", weight: 3 }, { code: "prob_leash", weight: 2 }] },
        { text: "무서워하며 보호자 뒤로 숨어요", tags: [{ code: "prob_sep", weight: 2 }] },
      ],
    },
    {
      code: "Q7_REWARD",
      text: "강아지가 가장 좋아하는 보상은 무엇인가요?",
      allowMultiple: false,
      answers: [
        { text: "간식 · 사료 보상", tags: [{ code: "goal_basic", weight: 1 }] },
        { text: "터그놀이 · 공놀이 장난감", tags: [{ code: "soc_excite", weight: 1 }] },
        { text: "보호자의 칭찬과 스킨십", tags: [{ code: "goal_basic", weight: 1 }] },
      ],
    },
  ];

  for (let qi = 0; qi < surveyData.length; qi++) {
    const q = surveyData[qi]!;
    const existingQ = await db
      .select()
      .from(s.surveyQuestions)
      .where(and(eq(s.surveyQuestions.code, q.code), eq(s.surveyQuestions.isDeleted, false)))
      .limit(1);
    let qId = existingQ[0]?.id;
    if (!qId) {
      const [createdQ] = await db
        .insert(s.surveyQuestions)
        .values({ code: q.code, text: q.text, allowMultiple: q.allowMultiple, sortOrder: qi + 1 })
        .returning();
      qId = createdQ!.id;

      for (let ai = 0; ai < q.answers.length; ai++) {
        const ans = q.answers[ai]!;
        const [createdA] = await db
          .insert(s.surveyAnswers)
          .values({ questionId: qId, text: ans.text, sortOrder: ai + 1 })
          .returning();
        for (const t of ans.tags) {
          const tagId = tagMap.get(t.code);
          if (tagId && createdA) {
            await db.insert(s.answerTags).values({ answerId: createdA.id, tagId, weight: t.weight });
          }
        }
      }
    }
  }

  // 7. Courses / Units / Lessons / Steps / Checklists / Quizzes / LevelTests (3개 코스)
  async function ensureCourse(input: {
    code: string;
    title: string;
    description: string;
    level: number;
    isPremium: boolean;
    sortOrder: number;
    tags: Array<{ code: string; weight: number }>;
    units: Array<{
      title: string;
      lessons: Array<{
        title: string;
        summary: string;
        youtubeVideoId: string;
        checklists: string[];
        questions: Array<{ text: string; choices: string[]; answerIndex: number; explanation: string }>;
      }>;
    }>;
  }) {
    const existing = await db
      .select()
      .from(s.courses)
      .where(and(eq(s.courses.code, input.code), eq(s.courses.isDeleted, false)))
      .limit(1);
    if (existing[0]) return existing[0];

    const [course] = await db
      .insert(s.courses)
      .values({
        code: input.code,
        title: input.title,
        description: input.description,
        level: input.level,
        isPremium: input.isPremium,
        isPublished: true,
        sortOrder: input.sortOrder,
      })
      .returning();

    for (const ct of input.tags) {
      const tagId = tagMap.get(ct.code);
      if (tagId && course) {
        await db.insert(s.courseTags).values({ courseId: course.id, tagId, weight: ct.weight });
      }
    }

    for (let ui = 0; ui < input.units.length; ui++) {
      const u = input.units[ui]!;
      const [unit] = await db
        .insert(s.units)
        .values({ courseId: course!.id, title: u.title, sortOrder: ui + 1 })
        .returning();

      for (let li = 0; li < u.lessons.length; li++) {
        const l = u.lessons[li]!;
        const [lesson] = await db
          .insert(s.lessons)
          .values({ unitId: unit!.id, title: l.title, summary: l.summary, sortOrder: li + 1 })
          .returning();

        await db.insert(s.lessonSteps).values({
          lessonId: lesson!.id,
          type: "VIDEO",
          sortOrder: 1,
          youtubeVideoId: l.youtubeVideoId,
          videoDurationS: 180,
        });

        const [practiceStep] = await db
          .insert(s.lessonSteps)
          .values({ lessonId: lesson!.id, type: "PRACTICE", sortOrder: 2 })
          .returning();

        for (let ci = 0; ci < l.checklists.length; ci++) {
          await db.insert(s.practiceChecklists).values({
            stepId: practiceStep!.id,
            text: l.checklists[ci]!,
            sortOrder: ci + 1,
          });
        }

        const [quizStep] = await db
          .insert(s.lessonSteps)
          .values({ lessonId: lesson!.id, type: "QUIZ", sortOrder: 3 })
          .returning();

        const [quiz] = await db.insert(s.quizzes).values({ stepId: quizStep!.id }).returning();

        for (let qqi = 0; qqi < l.questions.length; qqi++) {
          const qq = l.questions[qqi]!;
          await db.insert(s.quizQuestions).values({
            quizId: quiz!.id,
            text: qq.text,
            choices: qq.choices,
            answerIndex: qq.answerIndex,
            explanation: qq.explanation,
            sortOrder: qqi + 1,
          });
        }
      }
    }

    // 레벨테스트 1개 연결
    await db.insert(s.levelTests).values({
      courseId: course!.id,
      title: `${input.title} 진단 레벨테스트`,
      skipToUnitOrder: 2,
      questions: [
        {
          text: "강아지가 올바른 행동을 했을 때 보상(간식/칭찬)의 가장 효과적인 타이밍은?",
          choices: ["행동 직후 1~2초 이내", "10초 뒤에 천천히", "산책이 완전히 끝난 뒤", "보호자 기분 좋을 때"],
          answerIndex: 0,
          explanation: "강아지는 행동 직후 1~2초 내 보상이 주어져야 원인과 결과를 정확히 연결합니다.",
        },
        {
          text: "훈련 1회 세션의 권장 집중 시간은?",
          choices: ["30분 연속", "3~5분 짧고 즐겁게", "1시간 이상", "간식이 다 떨어질 때까지"],
          answerIndex: 1,
          explanation: "짧고 즐거운 3~5분 세션을 하루 여러 번 반복하는 것이 집중력과 성취도를 높입니다.",
        },
        {
          text: "산책 중 리드줄이 팽팽하게 당겨졌을 때 올바른 대처는?",
          choices: ["같이 뛰어가 준다", "그 자리에 멈춰 서서 줄이 느슨해지길 기다린다", "줄을 강하게 잡아챈다", "큰 소리로 혼낸다"],
          answerIndex: 1,
          explanation: "줄이 당겨지면 전진이 멈춘다는 일관된 규칙을 알려주는 것이 핵심입니다.",
        },
      ],
    });

    return course!;
  }

  const basicCourse = await ensureCourse({
    code: "PUPPY_BASIC_101",
    title: "기초 생활 매너 완성",
    description: "아이컨택, 앉아, 기다려, 배변 습관까지 반려견과 함께 사는 첫걸음을 완성합니다.",
    level: 1,
    isPremium: false,
    sortOrder: 1,
    tags: [
      { code: "puppy", weight: 3 },
      { code: "exp_none", weight: 3 },
      { code: "goal_basic", weight: 4 },
      { code: "prob_potty", weight: 2 },
    ],
    units: [
      {
        title: "Unit 1. 보호자와 눈 맞추기 & 기본 신호",
        lessons: [
          {
            title: "1강. 이름 부르면 눈 맞추기 (아이컨택)",
            summary: "모든 교육의 시작은 보호자의 얼굴을 바라보는 습관입니다.",
            youtubeVideoId: "dQw4w9WgXcQ",
            checklists: [
              "강아지 이름을 1번 부르고 눈이 마주치면 1초 내 칭찬+간식 제공",
              "조용한 실내에서 5회 중 4회 이상 아이컨택 성공",
              "간식 없이 손짓과 목소리만으로 2초간 시선 유지",
            ],
            questions: [
              {
                text: "이름을 불렀는데 강아지가 반응하지 않을 때 가장 좋은 방법은?",
                choices: ["이름을 5번 연속 크게 부른다", "한 번만 부르고 가벼운 소리로 주의를 끌어 눈 맞춤 시 보상한다", "바로 간식을 입에 넣어준다", "훈련을 포기한다"],
                answerIndex: 1,
                explanation: "이름을 반복해서 부르면 이름의 집중 신호 가치가 떨어집니다.",
              },
              {
                text: "아이컨택 훈련에서 보상 타이밍으로 알맞은 것은?",
                choices: ["눈을 돌린 뒤", "눈이 마주친 바로 그 순간(1~2초 내)", "5분 뒤", "다음 날"],
                answerIndex: 1,
                explanation: "눈이 마주치는 즉시 칭찬과 보상을 주어야 정확한 행동이 강화됩니다.",
              },
              {
                text: "처음 아이컨택 연습을 시작하기 가장 좋은 장소는?",
                choices: ["강아지 공원 한복판", "자극이 적은 조용한 실내", "차들이 많은 큰길", "동물병원 대기실"],
                answerIndex: 1,
                explanation: "난이도는 자극이 없는 조용한 실내에서 시작해 점진적으로 높입니다.",
              },
            ],
          },
          {
            title: "2강. 안정적인 '앉아'와 '기다려'",
            summary: "흥분을 가라앉히고 보호자의 신호를 기다리는 자기통제 연습입니다.",
            youtubeVideoId: "M7lc1UVf-VE",
            checklists: [
              "간식을 코앞에서 머리 위로 천천히 올려 자연스럽게 엉덩이가 닿게 유도",
              "앉은 상태에서 3초간 기다린 후 해제 신호('좋아')와 함께 보상",
              "식사 그릇을 내려놓기 전 '앉아' 1회 성공",
            ],
            questions: [
              {
                text: "'앉아'를 가르칠 때 엉덩이를 손으로 강하게 누르면 안 되는 이유는?",
                choices: ["시간이 오래 걸려서", "반사적으로 버티거나 손에 대한 거부감이 생길 수 있어서", "간식이 부족해서", "아무 상관 없다"],
                answerIndex: 1,
                explanation: "물리적 압박 대신 간식 루어링으로 스스로 앉도록 유도하는 것이 효과적입니다.",
              },
              {
                text: "'기다려' 훈련의 마무리로 반드시 필요한 신호는?",
                choices: ["갑자기 방을 나간다", "명확한 해제 신호(예: '좋아', '자유')", "큰 박수 소리", "목줄 당기기"],
                answerIndex: 1,
                explanation: "해제 신호를 알려주어야 강아지가 언제까지 기다려야 하는지 이해합니다.",
              },
              {
                text: "기다려 시간을 늘리는 올바른 단계는?",
                choices: ["처음부터 1분", "3초 -> 5초 -> 10초 순으로 점진적 증가", "무작위로 늘리기", "실패하면 혼내기"],
                answerIndex: 1,
                explanation: "성공 경험을 쌓으며 점진적으로 시간과 거리를 늘려야 합니다.",
              },
            ],
          },
        ],
      },
      {
        title: "Unit 2. 실내 배변과 휴식 매너",
        lessons: [
          {
            title: "3강. 배변 패드 성공률 90% 만드는 동선 설계",
            summary: "실수 없는 환경 관리와 즉각적인 보상으로 배변 습관을 잡습니다.",
            youtubeVideoId: "M7lc1UVf-VE",
            checklists: [
              "잠에서 깬 직후·식사 15분 뒤 배변 패드로 자연스럽게 안내",
              "패드 위 성공 직후 즉시 고가치 간식으로 칭찬",
              "실수 시 혼내지 않고 효소 탈취제로 냄새 완전 제거",
            ],
            questions: [
              {
                text: "강아지가 배변 실수를 했을 때 가장 올바른 대처는?",
                choices: ["코를 대고 혼낸다", "무반응으로 치우고 탈취제로 냄새를 완전히 없앤다", "패드를 치워버린다", "밥을 굶긴다"],
                answerIndex: 1,
                explanation: "실수 후 혼내면 보호자 눈을 피해 숨어서 배변하는 부작용이 생깁니다.",
              },
              {
                text: "배변 확률이 가장 높은 시간대가 아닌 것은?",
                choices: ["기상 직후", "식사 후 10~20분", "격렬한 놀이 직후", "깊은 숙면 중"],
                answerIndex: 3,
                explanation: "기상·식사·놀이 직후에 패드로 유도하면 성공률이 크게 올라갑니다.",
              },
            ],
          },
        ],
      },
    ],
  });

  await ensureCourse({
    code: "WALK_MANNER_201",
    title: "당기지 않는 여유로운 산책",
    description: "리드줄 당김, 외부 자극 흥분, 현관 출입 매너를 단계적으로 교정합니다.",
    level: 2,
    isPremium: false,
    sortOrder: 2,
    tags: [
      { code: "adolescent", weight: 3 },
      { code: "adult", weight: 2 },
      { code: "prob_leash", weight: 5 },
      { code: "soc_excite", weight: 3 },
      { code: "goal_fix", weight: 3 },
    ],
    units: [
      {
        title: "Unit 1. 현관문 흥분 낮추기 & 느슨한 리드줄",
        lessons: [
          {
            title: "1강. 현관문 앞에서 차분하게 대기하기",
            summary: "산책의 50%는 현관문을 열기 전 흥분도 조절에서 결정됩니다.",
            youtubeVideoId: "M7lc1UVf-VE",
            checklists: [
              "하네스 착용 후 문고리에 손만 대고 차분하면 보상",
              "문이 반쯤 열려도 보호자 '가자' 신호 전까지 대기 성공",
            ],
            questions: [
              {
                text: "현관문을 열자마자 강아지가 뛰어나가려 할 때 올바른 대응은?",
                choices: ["같이 뛰어 나간다", "문을 다시 닫고 차분해질 때까지 기다렸다가 반복한다", "리드줄을 길게 풀어준다", "소리를 지른다"],
                answerIndex: 1,
                explanation: "차분하게 기다려야 문이 열린다는 규칙을 일관되게 학습시킵니다.",
              },
            ],
          },
        ],
      },
    ],
  });

  const premiumCourse = await ensureCourse({
    code: "BARK_FIX_PRO_301",
    title: "[프리미엄] 아파트 짖음 & 분리불안 집중 교정",
    description: "외부 소음 민감성과 보호자 외출 불안을 체계적인 둔감화 프로토콜로 교정합니다.",
    level: 3,
    isPremium: true,
    sortOrder: 3,
    tags: [
      { code: "prob_bark", weight: 5 },
      { code: "prob_sep", weight: 5 },
      { code: "env_apt", weight: 4 },
      { code: "goal_fix", weight: 4 },
    ],
    units: [
      {
        title: "Unit 1. 소음 둔감화 프로토콜",
        lessons: [
          {
            title: "1강. 벨소리·발소리 역조건화 3단계",
            summary: "경계 대상 소리를 간식이 나오는 긍정 신호로 재연결합니다.",
            youtubeVideoId: "M7lc1UVf-VE",
            checklists: [
              "작은 볼륨의 녹음 벨소리 재생 직후 간식 제공 5회 반복",
              "짖기 전 보호자를 쳐다보는 순간 집중 보상",
            ],
            questions: [
              {
                text: "소음 둔감화 훈련 시 첫 볼륨 설정으로 적절한 수준은?",
                choices: ["최대 볼륨", "강아지가 소리를 인지하되 짖지 않는 아주 작은 볼륨", "무음", "현관문을 세게 두드린다"],
                answerIndex: 1,
                explanation: "역치 아래의 낮은 자극에서 시작해 긍정적 연상을 만드는 것이 핵심입니다.",
              },
            ],
          },
        ],
      },
    ],
  });

  // 8. Badges (배지 6종)
  const badgeSeeds: Array<{ code: string; kind: typeof s.badgeKindEnum.enumValues[number]; name: string; iconName: string; description: string }> = [
    { code: "FIRST_LESSON", kind: "MILESTONE", name: "첫 레슨 완주", iconName: "Sparkles", description: "첫 번째 교육 레슨을 완료했어요." },
    { code: "UNIT_MASTER", kind: "UNIT_COMPLETE", name: "유닛 마스터", iconName: "Award", description: "하나의 교육 유닛을 끝까지 완주했어요." },
    { code: "COURSE_PUPPY_BASIC", kind: "COURSE_COMPLETE", name: "기초 매너 졸업", iconName: "GraduationCap", description: "기초 생활 매너 완성 코스를 졸업했어요." },
    { code: "COURSE_WALK_MANNER", kind: "COURSE_COMPLETE", name: "산책 매너 우등생", iconName: "Footprints", description: "여유로운 산책 코스를 완주했어요." },
    { code: "STREAK_5", kind: "MILESTONE", name: "꾸준한 보호자", iconName: "Flame", description: "누적 5개 레슨을 이수했어요." },
    { code: "WELCOME_WAGGLE", kind: "EVENT", name: "와글 입학 배지", iconName: "Star", description: "와글 반려견 교육 학교에 입학했어요." },
  ];

  let welcomeBadgeId = 0;
  for (const b of badgeSeeds) {
    const existing = await db
      .select()
      .from(s.badges)
      .where(and(eq(s.badges.code, b.code), eq(s.badges.isDeleted, false)))
      .limit(1);
    if (existing[0]) {
      if (b.code === "WELCOME_WAGGLE") welcomeBadgeId = existing[0].id;
    } else {
      const [created] = await db.insert(s.badges).values(b).returning();
      if (created && b.code === "WELCOME_WAGGLE") welcomeBadgeId = created.id;
    }
  }

  // 9. Shop Categories & Products (실물 + 훈련사 문의권 + 프리미엄 잠금해제 + 스와이프용 추가 카테고리 4종)
  const catSeeds = [
    { code: "SNACK", name: "훈련 간식 · 용품", sortOrder: 1, iconName: "Package" },
    { code: "WALK", name: "산책 · 하네스", sortOrder: 2, iconName: "Footprints" },
    { code: "TOY", name: "노즈워크 · 장난감", sortOrder: 3, iconName: "Sparkles" },
    { code: "HYGIENE", name: "배변 · 위생용품", sortOrder: 4, iconName: "Droplets" },
    { code: "LIVING", name: "리빙 · 이동장", sortOrder: 5, iconName: "Home" },
    { code: "DIGITAL_COURSE", name: "프리미엄 교육", sortOrder: 6, iconName: "BookOpen" },
    { code: "TRAINER_QA", name: "훈련사 문의권", sortOrder: 7, iconName: "Video" },
  ];
  const catMap = new Map<string, number>();
  for (const c of catSeeds) {
    const existing = await db
      .select()
      .from(s.productCategories)
      .where(and(eq(s.productCategories.code, c.code), eq(s.productCategories.isDeleted, false)))
      .limit(1);
    if (existing[0]) {
      catMap.set(c.code, existing[0].id);
      if (existing[0].sortOrder !== c.sortOrder) {
        await db
          .update(s.productCategories)
          .set({ sortOrder: c.sortOrder })
          .where(eq(s.productCategories.id, existing[0].id));
      }
    } else {
      const [created] = await db.insert(s.productCategories).values(c).returning();
      if (created) catMap.set(c.code, created.id);
    }
  }

  const productSeeds: Array<{
    catCode: string;
    type: "PHYSICAL" | "INQUIRY_TICKET" | "PREMIUM_UNLOCK";
    name: string;
    description: string;
    pointPrice: number;
    shippingFee: number;
    stock: number;
    linkedCourseId?: number;
    isFeatured: boolean;
    variants?: Array<{ name: string; addPoint: number; stock: number }>;
  }> = [
    {
      catCode: "SNACK",
      type: "PHYSICAL",
      name: "와글 미니 트레이닝 트릿 (동결건조 닭가슴살)",
      description: "3~5분 집중 교육에 최적화된 한 입 크기 무첨가 트레이닝 간식입니다.",
      pointPrice: 1200,
      shippingFee: 0,
      stock: 150,
      isFeatured: true,
      variants: [
        { name: "닭가슴살 100g", addPoint: 0, stock: 80 },
        { name: "연어 100g (+200P)", addPoint: 200, stock: 70 },
      ],
    },
    {
      catCode: "SNACK",
      type: "PHYSICAL",
      name: "노슬립 산책 트레이닝 리드줄 (2m)",
      description: "손목 부담을 줄이고 느슨한 리드줄 연습을 돕는 실리콘 그립 리드줄입니다.",
      pointPrice: 3500,
      shippingFee: 0,
      stock: 60,
      isFeatured: true,
      variants: [
        { name: "차콜 블랙", addPoint: 0, stock: 30 },
        { name: "라임 민트", addPoint: 0, stock: 30 },
      ],
    },
    {
      catCode: "DIGITAL_COURSE",
      type: "PREMIUM_UNLOCK",
      name: "[잠금해제] 아파트 짖음 & 분리불안 집중 교정 코스",
      description: "결제 즉시 프리미엄 교육 코스의 모든 유닛과 레슨이 평생 잠금 해제됩니다.",
      pointPrice: 2000,
      shippingFee: 0,
      stock: 9999,
      linkedCourseId: premiumCourse.id,
      isFeatured: true,
    },
    {
      catCode: "TRAINER_QA",
      type: "INQUIRY_TICKET",
      name: "훈련사 1:1 비동기 영상 Q&A 이용권 (1회)",
      description: "우리 강아지 행동 영상을 올리면 전문 훈련사가 48시간 이내 맞춤 솔루션을 답변합니다.",
      pointPrice: 1500,
      shippingFee: 0,
      stock: 9999,
      isFeatured: false,
    },
  ];

  for (let pi = 0; pi < productSeeds.length; pi++) {
    const prod = productSeeds[pi]!;
    const existing = await db
      .select()
      .from(s.products)
      .where(and(eq(s.products.name, prod.name), eq(s.products.isDeleted, false)))
      .limit(1);
    if (existing.length === 0) {
      const [createdP] = await db
        .insert(s.products)
        .values({
          categoryId: catMap.get(prod.catCode)!,
          type: prod.type,
          name: prod.name,
          description: prod.description,
          pointPrice: prod.pointPrice,
          shippingFee: prod.shippingFee,
          stock: prod.stock,
          linkedCourseId: prod.linkedCourseId ?? null,
          status: "ACTIVE",
          isFeatured: prod.isFeatured,
          sortOrder: pi + 1,
        })
        .returning();

      if (createdP && prod.variants) {
        for (const v of prod.variants) {
          await db.insert(s.productVariants).values({
            productId: createdP.id,
            name: v.name,
            addPoint: v.addPoint,
            stock: v.stock,
          });
        }
      }
    }
  }

  // 9-2. 상품 실제 업로드 파일 복사(UPLOAD_DIR/products·editor) 및 리치 상세 HTML 시드 (4번 상품은 이미지 없음 폴백 검증용)
  const treatImg1 = copyBreedAssetToUpload("poodle-toy.webp", "products", "seed-treat-01.webp");
  const treatImg2 = copyBreedAssetToUpload("bichon.webp", "products", "seed-treat-02.webp");
  const treatImg3 = copyBreedAssetToUpload("maltipoo.webp", "products", "seed-treat-03.webp");
  const treatDetailImg = copyBreedAssetToUpload("bichon.webp", "editor", "seed-treat-detail-01.webp");

  const leashImg1 = copyBreedAssetToUpload("welsh-corgi.webp", "products", "seed-leash-01.webp");
  const leashImg2 = copyBreedAssetToUpload("shiba.webp", "products", "seed-leash-02.webp");
  const leashDetailImg = copyBreedAssetToUpload("welsh-corgi.webp", "editor", "seed-leash-detail-01.webp");

  const courseImg1 = copyBreedAssetToUpload("golden-retriever.webp", "products", "seed-course-01.webp");

  const productMediaSeed: Array<{
    name: string;
    images: string[];
    detailHtml: string;
  }> = [
    {
      name: "와글 미니 트레이닝 트릿 (동결건조 닭가슴살)",
      images: [treatImg1, treatImg2, treatImg3],
      detailHtml: `
        <h2>훈련 집중력을 높이는 0.5cm 초미니 보상 트릿</h2>
        <p>반려견 교육에서는 <strong>행동 직후 1~2초 이내</strong>에 빠르고 부담 없이 보상을 주는 것이 핵심입니다. 와글 미니 트레이닝 트릿은 한 입에 쏙 들어가는 크기로 씹는 시간을 줄여 레슨 집중 흐름을 끊지 않습니다.</p>
        <img src="${treatDetailImg}" alt="트레이닝 트릿 급여 예시" />
        <h3>이런 보호자님께 추천해요</h3>
        <ul>
          <li>하루 5분 집중 훈련 시 칼로리 부담 없이 여러 번 보상하고 싶은 분</li>
          <li>소형견·퍼피도 목 넘김 걱정 없이 먹을 수 있는 부드러운 동결건조 간식을 찾는 분</li>
          <li>인공 향료·보존료·색소가 없는 단일 원료 간식을 선호하는 분</li>
        </ul>
        <hr />
        <h3>급여 및 보관 안내</h3>
        <p>직사광선을 피해 서늘한 곳에 보관하고, 개봉 후에는 지퍼백을 완전히 밀봉해 주세요. 생후 3개월 이상 전 견종 급여 가능합니다.</p>
      `.trim(),
    },
    {
      name: "노슬립 산책 트레이닝 리드줄 (2m)",
      images: [leashImg1, leashImg2],
      detailHtml: `
        <h2>손목 부담을 줄인 실리콘 논슬립 산책 리드줄</h2>
        <p>산책 중 갑작스러운 당김에도 손에서 미끄러지지 않도록 웨빙 양면에 고탄성 실리콘 그립을 적용했습니다. <strong>2m 표준 길이</strong>로 보호자와 반려견이 여유롭게 보폭을 맞추며 느슨한 리드줄(Loose Leash) 훈련을 익힐 수 있습니다.</p>
        <img src="${leashDetailImg}" alt="노슬립 리드줄 산책 예시" />
        <h3>핵심 설계 포인트</h3>
        <ul>
          <li>초경량 알루미늄 카라비너 적용으로 소형견 목·하네스 부담 최소화</li>
          <li>야간 산책 안전을 위한 고휘도 3M 리플렉티브 스티치</li>
          <li>배변봉투 파우치·클리커를 걸 수 있는 손잡이 하단 D링</li>
        </ul>
      `.trim(),
    },
    {
      name: "[잠금해제] 아파트 짖음 & 분리불안 집중 교정 코스",
      images: [courseImg1],
      detailHtml: `
        <h2>공동주택 환경에 맞춘 3단계 행동 교정 커리큘럼</h2>
        <p>현관 벨소리, 복도 발소리, 보호자 외출 시 반복되는 짖음과 분리불안을 <strong>둔감화·역조건형성</strong> 원리로 차근차근 교정하는 프리미엄 코스입니다.</p>
        <ul>
          <li>결제 즉시 해당 코스의 모든 유닛·레슨·실습 체크리스트·퀴즈가 영구 잠금 해제됩니다.</li>
          <li>실물 배송이 없는 디지털 상품으로 구매 즉시 <strong>교육 탭</strong>에서 수강할 수 있습니다.</li>
        </ul>
      `.trim(),
    },
    {
      name: "훈련사 1:1 비동기 영상 Q&A 이용권 (1회)",
      images: [],
      detailHtml: `
        <h2>우리 강아지 행동 영상으로 받는 48시간 맞춤 솔루션</h2>
        <p>실제 생활 공간에서 촬영한 1분 내외의 행동 영상을 올려주시면, 담당 전문 훈련사가 문제 행동의 원인과 단계별 연습법을 상세히 답변해 드립니다.</p>
        <ul>
          <li>답변 SLA: 등록 후 <strong>48시간 이내</strong> (초과 시 사용 포인트 100% 자동 환불)</li>
          <li>디지털 이용권 상품으로 별도 배송 없이 바로 이용할 수 있습니다.</li>
        </ul>
      `.trim(),
    },
  ];

  const seededProductByName = new Map<string, number>();
  for (const pm of productMediaSeed) {
    const [prodRow] = await db
      .select({ id: s.products.id, detailHtml: s.products.detailHtml })
      .from(s.products)
      .where(and(eq(s.products.name, pm.name), eq(s.products.isDeleted, false)))
      .limit(1);
    if (!prodRow) continue;
    seededProductByName.set(pm.name, prodRow.id);

    if (!prodRow.detailHtml || prodRow.detailHtml.includes("/images/breeds/")) {
      await db
        .update(s.products)
        .set({ detailHtml: pm.detailHtml })
        .where(eq(s.products.id, prodRow.id));
    }

    if (pm.images.length > 0) {
      const existingImgs = await db
        .select({ id: s.productImages.id, url: s.productImages.url })
        .from(s.productImages)
        .where(and(eq(s.productImages.productId, prodRow.id), eq(s.productImages.isDeleted, false)));
      const hasLegacyBreedLink = existingImgs.some((img) => img.url.startsWith("/images/breeds/"));
      if (existingImgs.length === 0 || hasLegacyBreedLink) {
        if (hasLegacyBreedLink) {
          await db
            .update(s.productImages)
            .set({ isDeleted: true, deletedAt: new Date(), deletedBy: adminUser.id })
            .where(and(eq(s.productImages.productId, prodRow.id), eq(s.productImages.isDeleted, false)));
        }
        for (let idx = 0; idx < pm.images.length; idx++) {
          await db.insert(s.productImages).values({
            productId: prodRow.id,
            url: pm.images[idx]!,
            sortOrder: idx,
            createdBy: adminUser.id,
          });
        }
      }
    }
  }

  // 10. Trainers (훈련사 2명 — 1명은 trainerAdmin 계정 연동)
  let mainTrainerId = 0;
  const existingTrainer = await db
    .select()
    .from(s.trainers)
    .where(and(eq(s.trainers.adminId, trainerAdmin.id), eq(s.trainers.isDeleted, false)))
    .limit(1);
  if (existingTrainer[0]) {
    mainTrainerId = existingTrainer[0].id;
  } else {
    const [t1] = await db
      .insert(s.trainers)
      .values({
        adminId: trainerAdmin.id,
        name: "박훈련 수석훈련사",
        bio: "반려견 행동교정 10년 경력 · 아파트 짖음/산책 리드줄/분리불안 전문",
        careerYears: 10,
        isActive: true,
      })
      .returning();
    mainTrainerId = t1!.id;

    for (const code of ["prob_bark", "prob_leash", "prob_sep", "spec_behavior"]) {
      const tid = tagMap.get(code);
      if (tid) await db.insert(s.trainerTags).values({ trainerId: mainTrainerId, tagId: tid });
    }

    await db.insert(s.trainers).values({
      name: "이퍼피 전담훈련사",
      bio: "퍼피 사회화 · 기초 매너 · 배변 교육 전문",
      careerYears: 6,
      isActive: true,
    });
  }

  // 11. Notification Templates & Banners
  const tplSeeds = [
    { code: "DAILY_GOAL_REMINDER", title: "오늘의 5분 교육, 아직 안 하셨나요?", body: "우리 강아지와 오늘 목표 레슨을 완료하고 포인트를 받아보세요." },
    { code: "POINT_EXPIRE_SOON", title: "소멸 예정 포인트가 있어요", body: "30일 이내 만료되는 포인트를 포인트샵에서 사용해 보세요." },
    { code: "INQUIRY_ANSWERED", title: "훈련사님의 영상 답변이 도착했어요", body: "지금 Q&A 상세 화면에서 맞춤 솔루션을 확인해 보세요." },
    { code: "INQUIRY_REFUNDED", title: "문의 SLA 초과로 포인트가 환불되었어요", body: "48시간 내 답변이 지연되어 차감된 포인트가 전액 자동 환불되었습니다." },
  ];
  for (const tpl of tplSeeds) {
    const existing = await db
      .select()
      .from(s.notificationTemplates)
      .where(and(eq(s.notificationTemplates.code, tpl.code), eq(s.notificationTemplates.isDeleted, false)))
      .limit(1);
    if (existing.length === 0) {
      await db.insert(s.notificationTemplates).values(tpl);
    }
  }

  const existingBanners = await db.select().from(s.banners).where(eq(s.banners.isDeleted, false)).limit(1);
  if (existingBanners.length === 0) {
    await db.insert(s.banners).values([
      {
        title: "매일 5분 레슨 완주하고 포인트 받기",
        subtitle: "영상·실습·퀴즈 3단계 완료 시 즉시 적립",
        linkUrl: "/app/courses",
        placement: "HOME",
        accentToken: "brand-lime",
        sortOrder: 1,
        isActive: true,
      },
      {
        title: "포인트샵 신규 훈련 트릿 입고",
        subtitle: "적립한 포인트로 간식과 프리미엄 코스를 교환하세요",
        linkUrl: "/app/shop",
        placement: "SHOP_HOME",
        accentToken: "point-coral",
        sortOrder: 2,
        isActive: true,
      },
    ]);
  }

  // 12. Test User (user@waggle.kr / Waggle1234!) + Dog "초코" + Wallet 5,000P + Enrollment + Sample Inquiry
  const existingAcc = await db
    .select()
    .from(s.accounts)
    .where(and(eq(s.accounts.provider, "EMAIL"), eq(s.accounts.providerId, "user@waggle.kr"), eq(s.accounts.isDeleted, false)))
    .limit(1);

  if (existingAcc.length === 0) {
    const [acc] = await db
      .insert(s.accounts)
      .values({
        provider: "EMAIL",
        providerId: "user@waggle.kr",
        email: "user@waggle.kr",
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword("Waggle1234!"),
      })
      .returning();

    const [user] = await db
      .insert(s.users)
      .values({
        accountId: acc!.id,
        nickname: "초코맘",
        phone: "010-9000-1234",
        region: "서울 강남구",
        status: "ACTIVE",
        termsAgreedAt: new Date(),
        onboardingCompletedAt: new Date(),
      })
      .returning();

    const [dog] = await db
      .insert(s.dogs)
      .values({
        userId: user!.id,
        name: "초코",
        birthDate: "2025-09-15",
        breedId: breedMap.get("POODLE_TOY") ?? null,
        sizeClass: "SMALL",
        gender: "MALE",
        neutered: true,
        weightKg: "4.20",
        region: "서울 강남구",
        grade: 1,
        isPrimary: true,
      })
      .returning();

    await db.insert(s.dailyGoals).values({
      userId: user!.id,
      dailyLessonGoal: 2,
      reminderEnabled: true,
      reminderTime: "20:00",
    });

    await db.insert(s.pointWallets).values({
      userId: user!.id,
      balance: 5000,
    });

    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    await db.insert(s.pointLedgers).values({
      userId: user!.id,
      delta: 5000,
      balanceAfter: 5000,
      reason: "ADMIN_GRANT",
      idempotencyKey: `seed:welcome:${user!.id}`,
      refType: "admin_adjust",
      memo: "초기 테스트 시드 지급 (5,000P)",
      expiresAt,
      remainingAmount: 5000,
      createdBy: adminUser.id,
    });

    await db.insert(s.enrollments).values({
      dogId: dog!.id,
      courseId: basicCourse.id,
      status: "IN_PROGRESS",
    });

    if (welcomeBadgeId) {
      await db.insert(s.dogBadges).values({ dogId: dog!.id, badgeId: welcomeBadgeId });
    }

    if (firstVaccineId) {
      await db.insert(s.vaccinationRecords).values({
        dogId: dog!.id,
        vaccineId: firstVaccineId,
        administeredAt: new Date("2026-05-10T01:00:00Z"),
        nextDueAt: new Date("2027-05-10T01:00:00Z"),
        hospital: "와글 동물병원",
        memo: "연간 정기 접종 완료",
      });
    }

    await db.insert(s.inquiries).values({
      userId: user!.id,
      dogId: dog!.id,
      trainerId: mainTrainerId,
      question: "현관 택배 벨소리만 들리면 초코가 2분 넘게 짖어요. 어떤 순서로 둔감화 훈련을 시작하면 좋을까요?",
      paidPoints: 1500,
      status: "ASSIGNED",
      assignedAt: new Date(),
      slaDueAt: new Date(Date.now() + 40 * 60 * 60 * 1000),
    });

    await db.insert(s.notifications).values({
      userId: user!.id,
      kind: "NOTICE",
      title: "와글에 오신 것을 환영해요",
      body: "테스트 포인트 5,000P가 지급되었습니다. 오늘의 첫 레슨을 시작해 보세요.",
      deepLink: "/app/wallet",
    });
  }

  // 13. 포인트샵 구매확정/배송완료 샘플 주문 + 샘플 후기 3건 (멱등 시드)
  const [testAcc] = await db
    .select({ id: s.accounts.id })
    .from(s.accounts)
    .where(and(eq(s.accounts.provider, "EMAIL"), eq(s.accounts.providerId, "user@waggle.kr"), eq(s.accounts.isDeleted, false)))
    .limit(1);
  const [testUser] = testAcc
    ? await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(and(eq(s.users.accountId, testAcc.id), eq(s.users.isDeleted, false)))
        .limit(1)
    : [];

  const treatProductId = seededProductByName.get("와글 미니 트레이닝 트릿 (동결건조 닭가슴살)");
  const leashProductId = seededProductByName.get("노슬립 산책 트레이닝 리드줄 (2m)");

  async function ensureSeedReviewer(email: string, nickname: string): Promise<number> {
    const [exAcc] = await db
      .select({ id: s.accounts.id })
      .from(s.accounts)
      .where(and(eq(s.accounts.provider, "EMAIL"), eq(s.accounts.providerId, email), eq(s.accounts.isDeleted, false)))
      .limit(1);
    if (exAcc) {
      const [exUser] = await db
        .select({ id: s.users.id })
        .from(s.users)
        .where(eq(s.users.accountId, exAcc.id))
        .limit(1);
      if (exUser) return exUser.id;
    }
    const [newAcc] = await db
      .insert(s.accounts)
      .values({
        provider: "EMAIL",
        providerId: email,
        email,
        emailVerifiedAt: new Date(),
        passwordHash: hashPassword("Waggle1234!"),
      })
      .returning();
    const [newUser] = await db
      .insert(s.users)
      .values({
        accountId: newAcc!.id,
        nickname,
        status: "ACTIVE",
        termsAgreedAt: new Date(),
        onboardingCompletedAt: new Date(),
      })
      .returning();
    return newUser!.id;
  }

  if (testUser && treatProductId && leashProductId) {
    // (a) 테스트 유저 구매확정(CONFIRMED) 주문 — 상품 #1 후기 미작성 상태 (즉시 후기 작성 테스트 가능)
    const [exConf] = await db
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(eq(s.orders.orderNo, "WGLSEEDCONF01"))
      .limit(1);
    if (!exConf) {
      const [treatVar] = await db
        .select()
        .from(s.productVariants)
        .where(and(eq(s.productVariants.productId, treatProductId), eq(s.productVariants.isDeleted, false)))
        .limit(1);
      const deliveredDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000);
      const confirmedDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const [ord] = await db
        .insert(s.orders)
        .values({
          orderNo: "WGLSEEDCONF01",
          userId: testUser.id,
          status: "CONFIRMED",
          paidPoints: 1200,
          totalPoint: 1200,
          addressSnapshot: {
            receiver: "초코맘",
            phone: "010-9000-1234",
            zipcode: "06236",
            addr1: "서울 강남구 테헤란로 123",
            addr2: "101동 1004호",
          },
          paidAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
          confirmedAt: confirmedDate,
          createdBy: testUser.id,
        })
        .returning();
      await db.insert(s.orderItems).values({
        orderId: ord!.id,
        productId: treatProductId,
        variantId: treatVar?.id ?? null,
        nameSnap: `와글 미니 트레이닝 트릿 (동결건조 닭가슴살) (${treatVar?.name ?? "닭가슴살 100g"})`,
        productTypeSnap: "PHYSICAL",
        pointPrice: 1200,
        quantity: 1,
        createdBy: testUser.id,
      });
      await db.insert(s.shipments).values({
        orderId: ord!.id,
        courier: "CJ대한통운",
        trackingNo: "650123456789",
        status: "DELIVERED",
        shippedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveredAt: deliveredDate,
        createdBy: adminUser.id,
      });
    }

    // (b) 테스트 유저 배송완료(DELIVERED) 주문 — 상품 #2 (구매 확정 & 반품 신청 테스트용)
    const [exDelv] = await db
      .select({ id: s.orders.id })
      .from(s.orders)
      .where(eq(s.orders.orderNo, "WGLSEEDDELV02"))
      .limit(1);
    if (!exDelv) {
      const [leashVar] = await db
        .select()
        .from(s.productVariants)
        .where(and(eq(s.productVariants.productId, leashProductId), eq(s.productVariants.isDeleted, false)))
        .limit(1);
      const deliveredDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const [ord] = await db
        .insert(s.orders)
        .values({
          orderNo: "WGLSEEDDELV02",
          userId: testUser.id,
          status: "DELIVERED",
          paidPoints: 3500,
          totalPoint: 3500,
          addressSnapshot: {
            receiver: "초코맘",
            phone: "010-9000-1234",
            zipcode: "06236",
            addr1: "서울 강남구 테헤란로 123",
            addr2: "101동 1004호",
          },
          paidAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          createdBy: testUser.id,
        })
        .returning();
      await db.insert(s.orderItems).values({
        orderId: ord!.id,
        productId: leashProductId,
        variantId: leashVar?.id ?? null,
        nameSnap: `노슬립 산책 트레이닝 리드줄 (2m) (${leashVar?.name ?? "차콜 블랙"})`,
        productTypeSnap: "PHYSICAL",
        pointPrice: 3500,
        quantity: 1,
        createdBy: testUser.id,
      });
      await db.insert(s.shipments).values({
        orderId: ord!.id,
        courier: "한진택배",
        trackingNo: "420987654321",
        status: "DELIVERED",
        shippedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        deliveredAt: deliveredDate,
        createdBy: adminUser.id,
      });
    }

    // (c) 다른 보호자 샘플 후기 3건 (실제 UPLOAD_DIR/reviews 파일 복사 연동)
    const rev1ImgA = copyBreedAssetToUpload("welsh-corgi.webp", "reviews", "seed-review-01-a.webp");
    const rev1ImgB = copyBreedAssetToUpload("poodle-toy.webp", "reviews", "seed-review-01-b.webp");
    const rev2ImgA = copyBreedAssetToUpload("bichon.webp", "reviews", "seed-review-02-a.webp");

    const reviewerSamples = [
      {
        orderNo: "WGLSEEDREV01",
        email: "reviewer1@waggle.kr",
        nickname: "코기아빠",
        rating: 5,
        content:
          "훈련할 때 기존 간식은 찢어 주느라 손에 기름기도 묻고 타이밍을 놓치기 일쑤였는데, 이건 딱 새끼손톱 크기라 바로바로 보상하기 정말 편해요.\n우리 웰시코기가 입맛이 까다로운 편인데 봉지 소리만 들려도 앉아서 기다릴 정도로 기호성이 엄청 좋습니다.\n특히 하루 5분 앉아·기다려 레슨 따라 하면서 15알 넘게 줘도 칼로리 부담이 적어서 안심되고, 지퍼백 밀봉력도 좋아서 마지막 알까지 바삭함이 유지되네요. 재구매 의사 100%입니다!",
        imageUrls: [rev1ImgA, rev1ImgB],
        rewardPoint: 300,
        adminReply: "소중한 포토 후기 감사합니다! 코기와 즐거운 5분 트레이닝 루틴 이어가시길 와글이 응원할게요.",
      },
      {
        orderNo: "WGLSEEDREV02",
        email: "reviewer2@waggle.kr",
        nickname: "비숑누나",
        rating: 5,
        content:
          "소형견 치아에도 부담 없는 부드러운 동결건조 식감이라 퍼피 교육용으로 최고예요. 포인트 모아서 교환하니 체감 혜택이 훨씬 크네요!",
        imageUrls: [rev2ImgA],
        rewardPoint: 300,
        adminReply: null,
      },
      {
        orderNo: "WGLSEEDREV03",
        email: "reviewer3@waggle.kr",
        nickname: "시바집사",
        rating: 4,
        content:
          "기호성은 정말 좋고 부스러기도 적어서 산책 파우치에 넣고 다니기 좋아요. 다만 대용량 200g 옵션도 추후 출시되면 더 자주 살 것 같습니다.",
        imageUrls: [],
        rewardPoint: 100,
        adminReply: null,
      },
    ];

    for (const sample of reviewerSamples) {
      const [exOrd] = await db
        .select({ id: s.orders.id })
        .from(s.orders)
        .where(eq(s.orders.orderNo, sample.orderNo))
        .limit(1);
      if (exOrd) {
        if (sample.imageUrls.length > 0) {
          const [exRev] = await db
            .select({ id: s.productReviews.id, imageUrls: s.productReviews.imageUrls })
            .from(s.productReviews)
            .where(and(eq(s.productReviews.orderId, exOrd.id), eq(s.productReviews.isDeleted, false)))
            .limit(1);
          if (exRev && exRev.imageUrls.some((u) => u.startsWith("/images/breeds/"))) {
            await db
              .update(s.productReviews)
              .set({ imageUrls: sample.imageUrls })
              .where(eq(s.productReviews.id, exRev.id));
          }
        }
        continue;
      }

      const reviewerId = await ensureSeedReviewer(sample.email, sample.nickname);
      const [ord] = await db
        .insert(s.orders)
        .values({
          orderNo: sample.orderNo,
          userId: reviewerId,
          status: "CONFIRMED",
          paidPoints: 1200,
          totalPoint: 1200,
          addressSnapshot: {
            receiver: sample.nickname,
            phone: "010-8000-0000",
            zipcode: "06236",
            addr1: "서울 서초구 반포대로 10",
          },
          paidAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
          confirmedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          createdBy: reviewerId,
        })
        .returning();
      const [oi] = await db
        .insert(s.orderItems)
        .values({
          orderId: ord!.id,
          productId: treatProductId,
          nameSnap: "와글 미니 트레이닝 트릿 (동결건조 닭가슴살) (닭가슴살 100g)",
          productTypeSnap: "PHYSICAL",
          pointPrice: 1200,
          quantity: 1,
          createdBy: reviewerId,
        })
        .returning();
      await db.insert(s.productReviews).values({
        productId: treatProductId,
        orderId: ord!.id,
        orderItemId: oi!.id,
        userId: reviewerId,
        rating: sample.rating,
        content: sample.content,
        imageUrls: sample.imageUrls,
        rewardPoint: sample.rewardPoint,
        adminReply: sample.adminReply,
        adminRepliedAt: sample.adminReply ? new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) : null,
        createdBy: reviewerId,
      });
    }
  }

  console.log("[SEED] 완료! 테스트 계정: user@waggle.kr / admin@waggle.kr / trainer@waggle.kr");
}

seed()
  .catch((err) => {
    console.error("[SEED FAIL]", err);
    process.exit(1);
  })
  .finally(async () => {
    await getPool().end();
  });
