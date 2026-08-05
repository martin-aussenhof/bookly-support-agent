import type { Order } from "../types";

/**
 * Seed orders. Dates are stored as offsets from "now" so the fixtures stay
 * meaningful (inside/outside the 30-day return window) whenever the demo runs.
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
];
