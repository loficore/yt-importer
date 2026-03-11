interface RenderLikeResult {
  stdin: {
    write: (data: string) => void;
  };
  stdout: {
    frames: string[];
  };
}

async function waitForFrame(
  stdout: { frames: string[] },
  previousFrameCount: number,
): Promise<void> {
  const timeoutMs = 200;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    if (stdout.frames.length > previousFrameCount) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

export async function sendKey(
  instance: RenderLikeResult,
  key: string,
  expectFrameChange = true,
): Promise<void> {
  const previousFrameCount = instance.stdout.frames.length;
  instance.stdin.write(key);

  if (expectFrameChange) {
    await waitForFrame(instance.stdout, previousFrameCount);
  } else {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}
