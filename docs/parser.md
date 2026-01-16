 1. Parser解析数据包
 2. 每次扫描有一个metadata数据包和多个datapacket数据包
 3. metadata数据包包含扫描配置信息
 4. datapacket数据包包含扫描数据
 5. 收到medadata数据包时一次scan数据接收的开始，会创建currentScan对象，通过onConfig回调通知外部
 6. 收到data数据包时会通过onPacketReceived回调通知外部
 7. 收到所有datapacket数据包后会通过onComplete回调通知外部
 8. 无其它容错或恢复机制
 
可能的改进
1. 增加超时机制，在接收到metadata后，若出现超时未收到新的datapacket数据包，
   则认为当前scan数据接收完成，通过onComplete回调通知外部；
2. 如果在一次接收尚未完成时，收到了新的metadata数据包，
   则认为当前scan数据接收完成，通过onComplete回调通知外部，
   并创建新的currentScan对象，继续接收新的scan数据；

- [ ]  