
# dome-server

- Node.js express app with jade templates
- Runs on a local network from a raspberry pi
- Controls an LED strip via infrared transmitter on Tx and Rx pins.
    - Programmed for LED Strip: https://www.amazon.com/gp/product/B079MC16DJ/
    - Infrared transmitted with: YS-IRTM (Search "5V IR Infrared Remote Decoder Encoding Transmitter&Receiver Wireless Module" on eBay)

```
pi          YS-IRTM
+----+      +----+
| 5V |------| 5V |
| GND|------| GND|
| Tx |------| Rx |
| Rx |------| Tx |
+----+      +----+
```
