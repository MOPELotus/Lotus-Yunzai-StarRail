import { expect, test } from "bun:test";
import { parsePanelCommand } from "../panel-model.ts";

test("公开参考面板不会进入任何本人档案，普通面板依旧支持编号和 UID", () => {
  for (const input of ["*参考面板", "*参考面板2", "*希儿参考面板2", "*历史希儿参考面板",
    "#星铁123456789希儿参考面板", "#星铁希儿参考面板 2", "*希儿参考面版"]) {
    expect(parsePanelCommand(input)).toBeUndefined();
  }
  expect(parsePanelCommand("*希儿面板2")).toEqual({ type: "detail", name: "希儿", profileId: 2 });
  expect(parsePanelCommand("#星铁123456789希儿面板")).toEqual({ type: "detail", name: "希儿", profileId: 1, uid: "123456789" });
});
