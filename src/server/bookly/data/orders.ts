import type { Order } from "../types";

/**
 * Seed orders — the demo data set.
 *
 * Dates are offsets from "now" rather than fixed timestamps, so the
 * inside/outside-the-return-window cases stay correct whenever the demo runs.
 *
 * Each order exists to make one branch of the agent reachable; see the demo
 * script in the README for the matching prompts.
 *
 *   BK-10432  delivered, 2 items      → must ask which item before returning
 *   BK-10588  in transit              → tracking, nothing to return yet
 *   BK-09877  delivered 58 days ago   → outside the 30-day window
 *   BK-10601  processing              → cancel, not return
 *   BK-10774  signed edition          → final sale, refusal + escalation
 *   BK-10655  arrived damaged         → fault return, label fee waived
 *   BK-10233  "delivered", not seen   → missing-parcel path
 *   BK-10702  out for delivery, 3 items, high value → dense tracking reply
 */
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
const daysFromNow = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

export const ORDERS: Order[] = [
  {
    id: "BK-10432",
    email: "maya.chen@example.com",
    customerName: "Maya Chen",
    placedAt: daysAgo(9),
    status: "delivered",
    items: [
      {
        sku: "9780553380163",
        title: "A Brief History of Time",
        author: "Stephen Hawking",
        quantity: 1,
        unitPriceCents: 1899,
      },
      {
        sku: "9780374533557",
        title: "Thinking, Fast and Slow",
        author: "Daniel Kahneman",
        quantity: 1,
        unitPriceCents: 2150,
      },
    ],
    shipment: {
      carrier: "DHL",
      trackingNumber: "JD0142398765",
      estimatedDelivery: null,
      deliveredAt: daysAgo(4),
    },
    totalCents: 4049,
  },
  {
    id: "BK-10588",
    email: "maya.chen@example.com",
    customerName: "Maya Chen",
    placedAt: daysAgo(2),
    status: "in_transit",
    items: [
      {
        sku: "9780345391803",
        title: "The Hitchhiker's Guide to the Galaxy",
        author: "Douglas Adams",
        quantity: 2,
        unitPriceCents: 999,
      },
    ],
    shipment: {
      carrier: "DHL",
      trackingNumber: "JD0142411902",
      estimatedDelivery: daysFromNow(2),
      deliveredAt: null,
    },
    totalCents: 1998,
  },
  {
    // Signed edition — final sale. The agent must refuse and offer a human.
    id: "BK-10774",
    email: "maya.chen@example.com",
    customerName: "Maya Chen",
    placedAt: daysAgo(5),
    status: "delivered",
    items: [
      {
        sku: "9780571364886-SGN",
        title: "Klara and the Sun (Signed First Edition)",
        author: "Kazuo Ishiguro",
        quantity: 1,
        unitPriceCents: 4500,
        finalSale: true,
      },
      {
        sku: "9780099478461",
        title: "Never Let Me Go",
        author: "Kazuo Ishiguro",
        quantity: 1,
        unitPriceCents: 1299,
      },
    ],
    shipment: {
      carrier: "DHL",
      trackingNumber: "JD0142455310",
      estimatedDelivery: null,
      deliveredAt: daysAgo(2),
    },
    totalCents: 5799,
  },
  {
    id: "BK-09877",
    email: "sam.okafor@example.com",
    customerName: "Sam Okafor",
    placedAt: daysAgo(64),
    status: "delivered",
    items: [
      {
        sku: "9781501161933",
        title: "Educated",
        author: "Tara Westover",
        quantity: 1,
        unitPriceCents: 1725,
      },
    ],
    shipment: {
      carrier: "Royal Mail",
      trackingNumber: "RM884120033GB",
      estimatedDelivery: null,
      // Outside the 30-day return window — exercises the policy branch.
      deliveredAt: daysAgo(58),
    },
    totalCents: 1725,
  },
  {
    id: "BK-10601",
    email: "sam.okafor@example.com",
    customerName: "Sam Okafor",
    placedAt: daysAgo(1),
    status: "processing",
    items: [
      {
        sku: "9780062316097",
        title: "Sapiens",
        author: "Yuval Noah Harari",
        quantity: 1,
        unitPriceCents: 2299,
      },
    ],
    shipment: null,
    totalCents: 2299,
  },
  {
    // Arrived damaged — fault return, so the £2.99 label fee is waived.
    id: "BK-10655",
    email: "priya.raman@example.com",
    customerName: "Priya Raman",
    placedAt: daysAgo(8),
    status: "delivered",
    items: [
      {
        sku: "9780241988268",
        title: "Piranesi",
        author: "Susanna Clarke",
        quantity: 1,
        unitPriceCents: 1450,
      },
    ],
    shipment: {
      carrier: "Evri",
      trackingNumber: "EV5512090034",
      estimatedDelivery: null,
      deliveredAt: daysAgo(3),
    },
    totalCents: 1450,
  },
  {
    // Marked delivered, customer never received it — carrier investigation path.
    id: "BK-10233",
    email: "priya.raman@example.com",
    customerName: "Priya Raman",
    placedAt: daysAgo(11),
    status: "delivered",
    items: [
      {
        sku: "9781786892737",
        title: "Girl, Woman, Other",
        author: "Bernardine Evaristo",
        quantity: 1,
        unitPriceCents: 1599,
      },
    ],
    shipment: {
      carrier: "Evri",
      trackingNumber: "EV5511884471",
      estimatedDelivery: null,
      deliveredAt: daysAgo(6),
    },
    totalCents: 1599,
  },
  {
    id: "BK-10702",
    email: "james.whitlock@example.com",
    customerName: "James Whitlock",
    placedAt: daysAgo(3),
    status: "out_for_delivery",
    items: [
      {
        sku: "9780857526717",
        title: "The Overstory",
        author: "Richard Powers",
        quantity: 1,
        unitPriceCents: 1899,
      },
      {
        sku: "9781784742324",
        title: "Normal People",
        author: "Sally Rooney",
        quantity: 2,
        unitPriceCents: 1099,
      },
      {
        sku: "9780241435109",
        title: "Shuggie Bain",
        author: "Douglas Stuart",
        quantity: 1,
        unitPriceCents: 1650,
      },
    ],
    shipment: {
      carrier: "Royal Mail",
      trackingNumber: "RM884556710GB",
      estimatedDelivery: daysFromNow(0),
      deliveredAt: null,
    },
    totalCents: 5747,
  },
];
