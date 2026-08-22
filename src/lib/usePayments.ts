import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getPaymentsStatus } from "@/lib/payments.functions";

/**
 * Feature-flag gate for every buyer/seller payment surface.
 * While `enabled` is false, no payment UI should render anywhere.
 */
export function usePaymentsStatus() {
  const fetchStatus = useServerFn(getPaymentsStatus);
  return useQuery({
    queryKey: ["payments-status"],
    staleTime: 60_000,
    queryFn: () => fetchStatus(),
  });
}
