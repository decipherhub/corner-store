import {
  productionOperatorErrorCode,
  startProductionOperatorRuntime
} from "./production-runtime";

async function main(): Promise<void> {
  try {
    const runtime = await startProductionOperatorRuntime();
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        void runtime.shutdown(signal).finally(() => {
          process.exitCode = 0;
        });
      });
    }
  } catch (error) {
    console.error(JSON.stringify({event: "operator_api_start_failed", code: productionOperatorErrorCode(error)}));
    process.exitCode = 1;
  }
}

void main();
