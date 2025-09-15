import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const authHeader = request.headers.get('authorization')

        console.log('🔥 API代理收到请求:', {
            method: 'POST',
            hasAuth: !!authHeader,
            model: body.model,
            messagesCount: body.messages?.length || 0,
            hasImages: body.messages?.some((msg: any) =>
                msg.content?.some?.((item: any) => item.type === 'image_url')
            ) || false
        })

        if (!authHeader) {
            console.error('❌ 缺少授权头');
            return NextResponse.json(
                { error: { message: 'Authorization header is required' } },
                { status: 401 }
            )
        }

        // 创建2分钟超时控制器
        const timeoutController = new AbortController();
        const timeoutId = setTimeout(() => {
            timeoutController.abort();
        }, 120000); // 2分钟超时

        // 检查是否是流式请求
        const isStream = body.stream === true;

        // 处理图片数据（如果需要的话）
        let processedBody = body;

        // 检查是否有图片需要处理
        if (body.messages?.some((msg: any) =>
            msg.content?.some?.((item: any) => item.type === 'image_url')
        )) {
            console.log('🖼️ 检测到图片消息，准备发送到V-API');
        }

        // 转发请求到V-API
        console.log('🚀 转发请求到:', 'https://api.gpt.ge/v1/chat/completions', {
            stream: isStream,
            hasImages: processedBody.messages?.some((msg: any) =>
                msg.content?.some?.((item: any) => item.type === 'image_url')
            ) || false
        });

        const response = await fetch('https://api.gpt.ge/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': authHeader,
            },
            body: JSON.stringify(processedBody),
            signal: timeoutController.signal
        })

        clearTimeout(timeoutId);

        console.log('📡 V-API响应:', {
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            isStream,
            contentType: response.headers.get('content-type')
        });

        if (!response.ok) {
            const data = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
            console.error('❌ V-API返回错误:', data);
            return NextResponse.json(data, { status: response.status })
        }

        // 流式响应处理
        if (isStream) {
            console.log('🌊 开始流式响应处理');

            // 创建可读流
            const stream = new ReadableStream({
                start(controller) {
                    const reader = response.body?.getReader();
                    if (!reader) {
                        controller.error(new Error('无法创建读取器'));
                        return;
                    }

                    const pump = async () => {
                        try {
                            while (true) {
                                const { done, value } = await reader.read();
                                if (done) {
                                    console.log('✅ 流式响应完成');
                                    controller.close();
                                    break;
                                }
                                // 直接转发数据块
                                controller.enqueue(value);
                            }
                        } catch (error) {
                            console.error('❌ 流式响应错误:', error);
                            controller.error(error);
                        }
                    };

                    pump();
                }
            });

            return new Response(stream, {
                headers: {
                    'Content-Type': 'text/plain; charset=utf-8',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive',
                },
            });
        }

        // 非流式响应处理
        const data = await response.json()
        console.log('📄 响应数据:', {
            hasChoices: !!data.choices,
            choicesCount: data.choices?.length || 0,
            hasError: !!data.error
        });

        console.log('✅ 请求成功完成');
        return NextResponse.json(data)

    } catch (error) {
        console.error('❌ API代理错误:', error)

        // 提供更详细的错误信息
        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                return NextResponse.json(
                    { error: { message: 'V-API请求超时，请稍后重试' } },
                    { status: 504 }
                )
            }

            return NextResponse.json(
                { error: { message: `代理错误: ${error.message}` } },
                { status: 500 }
            )
        }

        return NextResponse.json(
            { error: { message: '服务器内部错误' } },
            { status: 500 }
        )
    }
}
