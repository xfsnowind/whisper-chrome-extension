import { useCallback } from "react";

const text = `
  《黑神话：悟空》自公布以来引发了广泛关注，作为一款国产动作角色扮演游戏，它不仅在国内玩家中掀起了热潮，甚至引起了国际市场的广泛兴趣。以下是对这款游戏的一些评测总结：

画面与美术设计

《黑神话：悟空》的画面效果堪称惊艳，游戏世界的细节打磨十分到位。无论是栩栩如生的角色设计、风格化的中国古典建筑，还是光影效果，都让人感受到制作团队对游戏视觉体验的追求。游戏运用了虚幻引擎5，使得角色的动作与环境的互动显得自然流畅，尤其是在高帧率下的战斗场景，打斗的动态表现力十足。

战斗系统

游戏的战斗系统有着类似《黑暗之魂》系列的高难度，但加入了自己的独特风格。悟空的形态切换、招式多变，再加上丰富的敌人类型和BOSS战，使得战斗节奏紧张刺激。玩家不仅需要精准的操作，还要掌握策略和时机才能在战斗中占据上风。这种设计增强了游戏的挑战性，但对于新手来说，可能需要一段时间适应。

剧情与角色塑造

游戏取材自《西游记》，但并未一味沿袭原著，而是对经典故事进行了重新演绎。悟空的成长历程和他与各种妖魔神怪的交锋，充满了东方神话的色彩。制作团队在剧情上试图平衡深度与可玩性，虽然目前透露的剧情片段有限，但足以看出这将是一段充满戏剧性和情感冲突的冒险之旅。

优化与技术表现

在游戏演示中，《黑神话：悟空》的帧率表现良好，无明显掉帧现象。不过，考虑到这款游戏的高精度图形和动态环境效果，如何在各种硬件平台上进行优化，将是未来的关键挑战。尤其是对中低端PC玩家，游戏的硬件需求可能较高，可能需要更好的硬件支持才能流畅体验。

总结

《黑神话：悟空》目前的表现无疑令人期待，它不仅展示了中国游戏行业在技术和美术上的进步，也有望在国际舞台上获得一席之地。对于动作游戏爱好者和《西游记》粉丝来说，这款游戏将是一部不容错过的作品。未来的正式发布将决定它能否真正成为一款经典之作。

这款游戏的未来值得期待。
`;

export default function useSummarize() {
  const createSummarizationSession = useCallback(
    async (
      type: AISummarizerType,
      format: AISummarizerFormat,
      length: AISummarizerLength,
      downloadProgressCallback?: AIModelDownloadCallback
    ): Promise<AISummarizerSession> => {
      const canSummarize = await window.ai.summarizer!.capabilities();
      if (canSummarize.available === "no") {
        throw new Error("AI Summarization is not supported");
      }

      const summarizationSession = await window.ai.summarizer!.create({
        type,
        format,
        length
      });
      if (canSummarize.available === "after-download") {
        if (downloadProgressCallback) {
          summarizationSession.addEventListener(
            "downloadprogress",
            downloadProgressCallback
          );
        }
        await summarizationSession.ready;
      }

      return summarizationSession;
    },
    []
  );

  const initializeApplication = useCallback(
    async (input?: string) => {
      const summarizationApiAvailable =
        window.ai !== undefined && window.ai.summarizer !== undefined;
      if (!summarizationApiAvailable) {
        console.error("Summarization API is not available");
        return;
      }

      const canSummarize = await window.ai.summarizer!.capabilities();
      if (canSummarize.available === "no") {
        console.error("Summarization API is not available");
        return;
      }

      let timeout: number | undefined = undefined;
      function scheduleSummarization() {
        // Debounces the call to the summarization API. This will run the summarization once the user
        // hasn't typed anything for at least 1 second.
        clearTimeout(timeout);
        timeout = setTimeout(async () => {
          const session = await createSummarizationSession(
            "tl;dr",
            "plain-text",
            "short"
          );
          const summary = await session.summarize(input ?? text);
          session.destroy();
          console.log(summary);
        }, 1000);
      }

      scheduleSummarization();
    },
    [createSummarizationSession]
  );

  return { initializeApplication };
}
