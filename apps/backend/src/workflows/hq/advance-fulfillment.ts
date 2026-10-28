import { Modules } from "@medusajs/framework/utils"

export type HqLifecycleAction =
  | "MARK_RECEIVED"
  | "AUTHENTICATE_AND_PACK"
  | "DISPATCH"
  | "MARK_DELIVERED"

type HqLifecycleInput = {
  action?: HqLifecycleAction
  certificate_url?: string
}

type HqTransition = {
  expectedStatus: string
  nextStatus: string
}

const transitions: Record<HqLifecycleAction, HqTransition> = {
  MARK_RECEIVED: {
    expectedStatus: "WAITING_FOR_ARRIVAL",
    nextStatus: "ARRIVED_AT_HQ",
  },
  AUTHENTICATE_AND_PACK: {
    expectedStatus: "ARRIVED_AT_HQ",
    nextStatus: "AUTHENTICATED_AND_PACKED",
  },
  DISPATCH: {
    expectedStatus: "AUTHENTICATED_AND_PACKED",
    nextStatus: "DISPATCHED",
  },
  MARK_DELIVERED: {
    expectedStatus: "DISPATCHED",
    nextStatus: "DELIVERED",
  },
}

export class HqLifecycleError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
  }
}

/**
 * Advances exactly one HQ line item through the required physical handoff
 * sequence. Sibling lines in a mixed-seller order are never affected.
 */
export const advanceHqFulfillment = async (
  container: any,
  fulfillmentId: string,
  input: HqLifecycleInput
) => {
  if (!input.action || !(input.action in transitions)) {
    throw new HqLifecycleError(400, "Unsupported HQ fulfillment action")
  }

  const hq = container.resolve("hq_fulfillment") as any
  const fulfillment = await hq.retrieveHqFulfillment(fulfillmentId)
  if (!fulfillment) throw new HqLifecycleError(404, "HQ fulfillment not found")

  if (["CANCELLED_BY_SELLER", "DELIVERED"].includes(fulfillment.hq_status)) {
    throw new HqLifecycleError(409, "This fulfillment can no longer transition")
  }

  const transition = transitions[input.action]
  if (fulfillment.hq_status !== transition.expectedStatus) {
    throw new HqLifecycleError(
      409,
      `${input.action} requires ${transition.expectedStatus}; current status is ${fulfillment.hq_status}`
    )
  }

  const changes: Record<string, unknown> = {
    id: fulfillment.id,
    hq_status: transition.nextStatus,
  }
  if (input.certificate_url) changes.certificate_url = input.certificate_url
  if (transition.nextStatus === "DELIVERED") changes.payout_released_at = new Date()

  return hq.updateHqFulfillments(changes)
}
