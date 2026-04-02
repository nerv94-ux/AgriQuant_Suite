"use client";

import { useCallback, useState } from "react";
import { mainApi } from "./mainApiClient";

type UseApiActionState<TResponse> = {
  data: TResponse | null;
  loading: boolean;
  error: string | null;
};

function useApiAction<TRequest, TResponse>(action: (request: TRequest) => Promise<TResponse>) {
  const [state, setState] = useState<UseApiActionState<TResponse>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (request: TRequest) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await action(request);
        setState({ data, loading: false, error: null });
        return data;
      } catch (error) {
        const message = error instanceof Error ? error.message : "요청 처리 중 오류가 발생했습니다.";
        setState((prev) => ({ ...prev, loading: false, error: message }));
        throw error;
      }
    },
    [action]
  );

  const reset = useCallback(() => {
    setState({ data: null, loading: false, error: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}

export function useAiChat() {
  return useApiAction(mainApi.ai.chat);
}

export function useErpProductGet() {
  return useApiAction(mainApi.erp.products.get);
}

export function useErpProductList() {
  return useApiAction(mainApi.erp.products.list);
}

export function useErpInventoryGet() {
  return useApiAction(mainApi.erp.inventory.get);
}

export function useErpInventoryList() {
  return useApiAction(mainApi.erp.inventory.list);
}

export function useErpInventoryByLocationGet() {
  return useApiAction(mainApi.erp.inventory.byLocation.get);
}

export function useErpInventoryByLocationList() {
  return useApiAction(mainApi.erp.inventory.byLocation.list);
}

export function useErpPurchasesOrdersList() {
  return useApiAction(mainApi.erp.purchases.orders.list);
}

export function useWeatherWarning() {
  return useApiAction(mainApi.weather.warning);
}

export function useWeatherForecast() {
  return useApiAction(mainApi.weather.forecast);
}
