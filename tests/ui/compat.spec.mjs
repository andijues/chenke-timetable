import {test,expect} from '@playwright/test';
import path from 'node:path';

test.beforeEach(async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(()=>{
    globalThis.Iterator=undefined;
    Promise.withResolvers=undefined;
    ReadableStream.prototype.values=undefined;
    ReadableStream.prototype[Symbol.asyncIterator]=undefined;
    Map.prototype.getOrInsert=undefined;
    Map.prototype.getOrInsertComputed=undefined;
    for(const name of ['difference','intersection','isDisjointFrom','isSubsetOf','isSupersetOf','symmetricDifference','union'])Set.prototype[name]=undefined;
  });
});

test('旧 WebView 缺少 Iterator 和 Promise.withResolvers 时仍能启动并读取 PDF',async({page})=>{
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'把课表放进生活里。'})).toBeVisible();
  await page.getByRole('button',{name:'导入我的课表'}).click();
  await page.locator('#file-input').setInputFiles(path.resolve('tests/fixtures/sample-timetable.pdf'));
  await expect(page.getByRole('heading',{name:/识别结果/})).toBeVisible();
  await expect(page.locator('.review-row')).toHaveCount(4);
  await expect(page.locator('.review-list')).toContainText('高等数学');
  expect(errors).toEqual([]);
});

test('旧 WebView 的流读取在中止和出错后释放锁，并支持保留源流',async({page})=>{
  await page.goto('/');
  await expect(page.getByRole('heading',{name:'把课表放进生活里。'})).toBeVisible();
  const result=await page.evaluate(async()=>{
    let canceled=false,preservedCanceled=false;
    const canceledStream=new ReadableStream({start(controller){controller.enqueue('第一段');},cancel(){canceled=true;}});
    for await(const chunk of canceledStream){if(chunk)break;}
    const preserved=new ReadableStream({start(controller){controller.enqueue('保留');},cancel(){preservedCanceled=true;}});
    for await(const chunk of preserved.values({preventCancel:true})){if(chunk)break;}
    const failed=new ReadableStream({start(controller){controller.error(new Error('读取失败'));}});
    let error='';try {await failed[Symbol.asyncIterator]().next();}catch(reason){error=reason.message;}
    return {canceled,canceledLocked:canceledStream.locked,preservedCanceled,preservedLocked:preserved.locked,failedLocked:failed.locked,error};
  });
  expect(result).toEqual({canceled:true,canceledLocked:false,preservedCanceled:false,preservedLocked:false,failedLocked:false,error:'读取失败'});
});
