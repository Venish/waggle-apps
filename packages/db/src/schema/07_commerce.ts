import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./01_auth";
import { dogs } from "./02_dog_daily";
import { courses } from "./04_education";
import { idColumn, mutableAuditColumns } from "./_helpers";

export const productTypeEnum = pgEnum("product_type", [
  "PHYSICAL",
  "INQUIRY_TICKET",
  "PREMIUM_UNLOCK",
]);

export const ticketTypeEnum = pgEnum("ticket_type", [
  "PREMIUM_UNLOCK",
  "INQUIRY_TICKET",
]);

export const ticketStatusEnum = pgEnum("ticket_status", [
  "AVAILABLE",
  "USED",
  "EXPIRED",
  "REVOKED",
]);

export const productStatusEnum = pgEnum("product_status", ["ACTIVE", "INACTIVE", "SOLD_OUT"]);

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING",
  "PAID",
  "PREPARING",
  "SHIPPING",
  "DELIVERED",
  "CONFIRMED",
  "CANCEL_REQUESTED",
  "RETURN_REQUESTED",
  "CANCELLED",
  "REFUNDED",
  "FAILED",
]);

export const shipmentStatusEnum = pgEnum("shipment_status", [
  "READY",
  "SHIPPING",
  "DELIVERED",
  "RETURNED",
]);

// 40. product_categories [MUTABLE]
export const productCategories = pgTable(
  "product_categories",
  {
    id: idColumn(),
    code: varchar("code", { length: 60 }).notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    iconName: varchar("icon_name", { length: 60 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_product_categories_code_active")
      .on(t.code)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 41. products [MUTABLE]
export const products = pgTable(
  "products",
  {
    id: idColumn(),
    categoryId: bigint("category_id", { mode: "number" })
      .notNull()
      .references(() => productCategories.id, { onDelete: "restrict" }),
    type: productTypeEnum("type").notNull().default("PHYSICAL"),
    name: varchar("name", { length: 150 }).notNull(),
    description: text("description"),
    detailHtml: text("detail_html"),
    pointPrice: bigint("point_price", { mode: "number" }).notNull().default(0),
    cashPrice: bigint("cash_price", { mode: "number" }).notNull().default(0),
    shippingFee: bigint("shipping_fee", { mode: "number" }).notNull().default(0),
    stock: integer("stock").notNull().default(0),
    linkedCourseId: bigint("linked_course_id", { mode: "number" }).references(() => courses.id, {
      onDelete: "restrict",
    }),
    status: productStatusEnum("status").notNull().default("ACTIVE"),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_products_cat_status").on(t.categoryId, t.status)],
);

// 42. product_images [MUTABLE]
export const productImages = pgTable(
  "product_images",
  {
    id: idColumn(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    url: text("url").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_product_images_product").on(t.productId, t.sortOrder)],
);

// 43. product_variants [MUTABLE]
export const productVariants = pgTable(
  "product_variants",
  {
    id: idColumn(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 100 }).notNull(),
    addPoint: bigint("add_point", { mode: "number" }).notNull().default(0),
    addCash: bigint("add_cash", { mode: "number" }).notNull().default(0),
    stock: integer("stock").notNull().default(0),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_product_variants_product").on(t.productId)],
);

// 44. carts [MUTABLE]
export const carts = pgTable(
  "carts",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_carts_user_active")
      .on(t.userId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 45. cart_items [MUTABLE]
export const cartItems = pgTable(
  "cart_items",
  {
    id: idColumn(),
    cartId: bigint("cart_id", { mode: "number" })
      .notNull()
      .references(() => carts.id, { onDelete: "restrict" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: bigint("variant_id", { mode: "number" }).references(() => productVariants.id, {
      onDelete: "restrict",
    }),
    quantity: integer("quantity").notNull().default(1),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_cart_items_cart").on(t.cartId)],
);

// 46. addresses [MUTABLE]
export const addresses = pgTable(
  "addresses",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    receiver: varchar("receiver", { length: 60 }).notNull(),
    phone: varchar("phone", { length: 30 }).notNull(),
    zipcode: varchar("zipcode", { length: 16 }).notNull(),
    addr1: varchar("addr1", { length: 200 }).notNull(),
    addr2: varchar("addr2", { length: 200 }),
    isDefault: boolean("is_default").notNull().default(false),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_addresses_user").on(t.userId)],
);

export interface OrderAddressSnapshot {
  receiver: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2?: string;
}

// 47. orders [MUTABLE]
export const orders = pgTable(
  "orders",
  {
    id: idColumn(),
    orderNo: varchar("order_no", { length: 40 }).notNull(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    paidPoints: bigint("paid_points", { mode: "number" }).notNull().default(0),
    cashAmount: bigint("cash_amount", { mode: "number" }).notNull().default(0),
    shippingFee: bigint("shipping_fee", { mode: "number" }).notNull().default(0),
    totalPoint: bigint("total_point", { mode: "number" }).notNull().default(0),
    totalCash: bigint("total_cash", { mode: "number" }).notNull().default(0),
    addressSnapshot: jsonb("address_snapshot").$type<OrderAddressSnapshot>().notNull(),
    paymentId: varchar("payment_id", { length: 191 }),
    idempotencyKey: varchar("idempotency_key", { length: 100 }),
    paidAt: timestamp("paid_at", { withTimezone: true, precision: 3 }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true, precision: 3 }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true, precision: 3 }),
    refundedAt: timestamp("refunded_at", { withTimezone: true, precision: 3 }),
    cancelReason: text("cancel_reason"),
    adminRejectReason: text("admin_reject_reason"),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_orders_no_active")
      .on(t.orderNo)
      .where(sql`${t.isDeleted} = false`),
    uniqueIndex("uq_orders_idempotency")
      .on(t.idempotencyKey)
      .where(sql`${t.idempotencyKey} IS NOT NULL`),
    index("idx_orders_user_created").on(t.userId, t.createdAt),
    index("idx_orders_status").on(t.status),
  ],
);

// 48. order_items [MUTABLE]
export const orderItems = pgTable(
  "order_items",
  {
    id: idColumn(),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    variantId: bigint("variant_id", { mode: "number" }).references(() => productVariants.id, {
      onDelete: "restrict",
    }),
    nameSnap: varchar("name_snap", { length: 200 }).notNull(),
    productTypeSnap: productTypeEnum("product_type_snap").notNull().default("PHYSICAL"),
    pointPrice: bigint("point_price", { mode: "number" }).notNull().default(0),
    cashPrice: bigint("cash_price", { mode: "number" }).notNull().default(0),
    quantity: integer("quantity").notNull().default(1),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_order_items_order").on(t.orderId)],
);

// 49. shipments [MUTABLE]
export const shipments = pgTable(
  "shipments",
  {
    id: idColumn(),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    courier: varchar("courier", { length: 60 }),
    trackingNo: varchar("tracking_no", { length: 100 }),
    status: shipmentStatusEnum("status").notNull().default("READY"),
    shippedAt: timestamp("shipped_at", { withTimezone: true, precision: 3 }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true, precision: 3 }),
    ...mutableAuditColumns(),
  },
  (t) => [index("idx_shipments_order").on(t.orderId)],
);

// 50. course_unlocks [MUTABLE]
export const courseUnlocks = pgTable(
  "course_unlocks",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    courseId: bigint("course_id", { mode: "number" })
      .notNull()
      .references(() => courses.id, { onDelete: "restrict" }),
    orderId: bigint("order_id", { mode: "number" }).references(() => orders.id, {
      onDelete: "restrict",
    }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_course_unlocks_active")
      .on(t.userId, t.courseId)
      .where(sql`${t.isDeleted} = false`),
  ],
);

// 51. product_reviews [MUTABLE] — 구매 확정(CONFIRMED) 실물 상품 품목당 1회 후기
export const productReviews = pgTable(
  "product_reviews",
  {
    id: idColumn(),
    productId: bigint("product_id", { mode: "number" })
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    orderId: bigint("order_id", { mode: "number" })
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),
    orderItemId: bigint("order_item_id", { mode: "number" })
      .notNull()
      .references(() => orderItems.id, { onDelete: "restrict" }),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    rating: smallint("rating").notNull(),
    content: text("content").notNull(),
    imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
    rewardPoint: integer("reward_point").notNull().default(0),
    isHidden: boolean("is_hidden").notNull().default(false),
    adminReply: text("admin_reply"),
    adminRepliedAt: timestamp("admin_replied_at", { withTimezone: true, precision: 3 }),
    ...mutableAuditColumns(),
  },
  (t) => [
    uniqueIndex("uq_product_reviews_order_item_active")
      .on(t.orderItemId)
      .where(sql`${t.isDeleted} = false`),
    index("idx_product_reviews_product_visible").on(t.productId, t.isHidden, t.createdAt),
    index("idx_product_reviews_user").on(t.userId),
  ],
);

// 52. user_tickets [MUTABLE] — 포인트샵 구매형 디지털 이용권/티켓 (프리미엄 코스 해제권 · 1:1 영상 Q&A 문의권)
export const userTickets = pgTable(
  "user_tickets",
  {
    id: idColumn(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    ticketType: ticketTypeEnum("ticket_type").notNull(),
    productId: bigint("product_id", { mode: "number" }).references(() => products.id, {
      onDelete: "restrict",
    }),
    orderId: bigint("order_id", { mode: "number" }).references(() => orders.id, {
      onDelete: "restrict",
    }),
    courseId: bigint("course_id", { mode: "number" }).references(() => courses.id, {
      onDelete: "restrict",
    }),
    titleSnap: varchar("title_snap", { length: 200 }).notNull(),
    status: ticketStatusEnum("status").notNull().default("AVAILABLE"),
    // 현재 구매형 디지털 상품은 유효기간 없음(NULL). 추후 기간제 쿠폰 도입 시 그대로 활용.
    expiresAt: timestamp("expires_at", { withTimezone: true, precision: 3 }),
    usedAt: timestamp("used_at", { withTimezone: true, precision: 3 }),
    usedRefId: bigint("used_ref_id", { mode: "number" }),
    usedDogId: bigint("used_dog_id", { mode: "number" }).references(() => dogs.id, {
      onDelete: "restrict",
    }),
    ...mutableAuditColumns(),
  },
  (t) => [
    index("idx_user_tickets_user_status").on(t.userId, t.status, t.createdAt),
    index("idx_user_tickets_order").on(t.orderId),
    index("idx_user_tickets_user_course").on(t.userId, t.courseId, t.status),
  ],
);
