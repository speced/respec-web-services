import { Request, Response } from "express";
import fetch from "node-fetch";

const PAYMENT_POINTERS = [
  "$ilp.uphold.com/DwJmxPHHi8K3", // Marcos
  "$ilp.uphold.com/PM3RAZfjyXWf", // Sid
].map(paymentPointerToURL);

export default async function route(_req: Request, res: Response) {
  const paymentPointer = random(PAYMENT_POINTERS);
  const spsp = await fetch(paymentPointer, {
    headers: { accept: "application/spsp4+json" },
  }).then(r => r.json());
  res.json(spsp);
}

function random<T>(list: T[]) {
  const idx = Math.floor(Math.random() * list.length);
  return list[idx];
}

// https://paymentpointers.org/syntax-resolution/
function paymentPointerToURL(pointer: string) {
  const url = new URL(pointer.replace(/^\$/, "https://"));
  if (!url.pathname) {
    url.pathname = "/.well-known/pay";
  }
  return url;
}
