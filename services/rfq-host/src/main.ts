import {runtimeErrorCode, startProductionRFQRuntime} from "./runtime";

async function main(): Promise<void> {
  try {
    const runtime = await startProductionRFQRuntime();
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      process.once(signal, () => {
        void runtime.shutdown(signal).finally(() => {
          process.exitCode = 0;
        });
      });
    }
  } catch (error) {
    console.error(JSON.stringify({event: "rfq_host_start_failed", code: runtimeErrorCode(error)}));
    process.exitCode = 1;
  }
}

void main();
