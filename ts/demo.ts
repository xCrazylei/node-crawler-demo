import Crawler, { CrawlerRequestResponse } from "crawler";
import async, { AsyncResultCallback } from "async";
import fs from "fs";
import path from "path";

const url: string = `http://www.52ggd.com/book/5/5203`;

interface Chapter {
  link: string;
  name: string;
}

/** 获取小说所有章节 */
const getAllChapter = (callback: AsyncResultCallback<any, Error>) => {
  var chapterList: Chapter[] = [];
  const crawler = new Crawler({
    callback: (error: Error, res: CrawlerRequestResponse, done: () => void) => {
      if (error) {
        console.error(error);
      }
      const $: cheerio.CheerioAPI = res.$;

      const container: cheerio.Cheerio = $(".chapterlist");
      const lis: cheerio.Cheerio = $(container[0]).children("dd");

      (lis || []).map((index, i: cheerio.Element) => {
        chapterList.push({
          /** 这里路由拼进去一个/ */
          link: `${url}/${$(i).children("a").attr("href")}`,
          name: $(i).children("a").text(),
        });
      });

      done();
    },
  });

  /** 选取小说的目录页 */
  crawler.queue(url);

  /** 队列结束调用 */
  crawler.on("drain", async () => {
    console.log(`所有章节已导出 共${chapterList.length}章`);
    /** async 回调，第一个参数为错误信息，没有错误就null */
    /** chapterList 最终会传递到下一个队列 */
    callback(null, chapterList);
  });
};

/** 获取小说内容 */
const getContent = (
  chapterList: Chapter[],
  callback: AsyncResultCallback<any, Error>
) => {
  const crawler = new Crawler({
    maxConnections: 200 /** 队列执行的个数，设置大些，防止章节过多丢失 */,
    callback: async (
      error: Error,
      res: CrawlerRequestResponse,
      done: () => void
    ) => {
      if (error) {
        console.error(error);
      }
      const $: cheerio.CheerioAPI = res.$;

      const contentBox: cheerio.Cheerio = $("#BookText");
      const content: string = $(contentBox[0]).text();

      console.log(`开始爬取【${res.options.filename}】`);

      const localPath = path.resolve(__dirname, `../txt`);
      !fs.existsSync(localPath) && fs.mkdirSync(localPath);
      await fs
        .createWriteStream(
          path.resolve(localPath, `${res.options.filename}.txt`)
        )
        .write(content);

      done();
    },
  });

  /** queue队列并行执行 */
  crawler.queue(
    chapterList.map((item) => {
      return { uri: item.link, filename: item.name };
    })
  );

  crawler.on("drain", async () => {
    console.log(`所有内容写入完毕，存入：${path.resolve(__dirname, `../txt`)}`);
    callback(null);
  });
};

(async () => {
  /** 使用async列队，分为两个实例爬取 */
  /** waterfall函数可将上次的执行结果传递到下一次 */
  console.time("执行时间");
  console.log("爬虫开始");
  async.waterfall(
    [getAllChapter, getContent],
    (error: Error | null | undefined, res: any) => {
      if (error) {
        console.error(error);
      } else {
        console.log("爬虫结束");
      }
      console.timeEnd("执行时间");
    }
  );
})();
