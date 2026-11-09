A ratio is the time of the baseline over the time of the arm with the verb `bigfloat`. Below 1, the baseline is faster.

| Arm | Baseline | Verdict for the baseline | Median ratio | small | large | well | ill | orient-random | orient-near | incircle-random | incircle-near |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| stage | exact | faster | 0.2899 | faster 0.05635 | faster 0.2838 | slower 2.323 | faster 0.2299 | faster 0.2878 | faster 0.2670 | faster 0.4589 | faster 0.9388 |
| stage | interval | faster | 0.03365 | faster 0.02274 | faster 0.1293 | faster 0.03427 | faster 0.02767 | faster 0.02755 | faster 0.02733 | faster 0.03909 | faster 0.04155 |
| 64 | exact | faster | 0.4431 | faster 0.09936 | faster 0.2815 | slower 2.821 | cannot decide 0.6147 | faster 0.4366 | faster 0.3762 | faster 0.4942 | same 1.011 |
| 64 | interval | faster | 0.04318 | faster 0.05712 | faster 0.1320 | faster 0.04316 | faster 0.07670 | faster 0.04010 | faster 0.03782 | faster 0.04161 | faster 0.04335 |
| 128 | exact | faster | 0.4412 | faster 0.09209 | faster 0.2640 | slower 2.785 | cannot decide 0.6375 | faster 0.4346 | faster 0.4104 | faster 0.5289 | slower 1.082 |
| 128 | interval | faster | 0.04494 | faster 0.05290 | faster 0.1222 | faster 0.04398 | faster 0.08248 | faster 0.03989 | faster 0.04252 | faster 0.04397 | faster 0.04588 |
| 256 | exact | faster | 0.4453 | faster 0.08184 | faster 0.2315 | slower 2.798 | cannot decide 0.6414 | faster 0.4357 | faster 0.4084 | faster 0.5288 | slower 1.168 |
| 256 | interval | faster | 0.04608 | faster 0.04817 | faster 0.1066 | faster 0.04375 | faster 0.08278 | faster 0.03941 | faster 0.04203 | faster 0.04382 | faster 0.05007 |
| 512 | exact | faster | 0.4418 | faster 0.07907 | faster 0.1716 | slower 3.008 | cannot decide 0.6516 | faster 0.4321 | faster 0.4073 | faster 0.5258 | slower 1.162 |
| 512 | interval | faster | 0.04916 | faster 0.04205 | faster 0.07775 | faster 0.04535 | faster 0.08364 | faster 0.03984 | faster 0.04220 | faster 0.04632 | faster 0.04976 |
| 1024 | exact | faster | 0.4686 | faster 0.03515 | faster 0.09494 | slower 3.038 | cannot decide 0.6410 | faster 0.4328 | faster 0.4078 | faster 0.5302 | slower 1.183 |
| 1024 | interval | faster | 0.04466 | faster 0.02274 | faster 0.04343 | faster 0.04644 | faster 0.07990 | faster 0.03983 | faster 0.04200 | faster 0.04674 | faster 0.05122 |
| 2048 | exact | faster | 0.4512 | faster 0.01613 | faster 0.04169 | slower 3.034 | cannot decide 0.6408 | faster 0.4319 | faster 0.4072 | faster 0.5270 | slower 1.163 |
| 2048 | interval | faster | 0.04329 | faster 0.01013 | faster 0.01825 | faster 0.04552 | faster 0.08525 | faster 0.03937 | faster 0.04203 | faster 0.04464 | faster 0.05192 |
| 4096 | exact | faster | 0.4419 | faster 0.01498 | faster 0.01571 | slower 3.055 | cannot decide 0.6455 | faster 0.4305 | faster 0.4061 | faster 0.5235 | slower 1.171 |
| 4096 | interval | faster | 0.04292 | faster 0.008348 | faster 0.006802 | faster 0.04640 | faster 0.08214 | faster 0.03935 | faster 0.04147 | faster 0.04390 | faster 0.05083 |

| Arm | Cost (ns for one node and one point) |
| --- | --- |
| interval | 84.76 |
| exact | 792.8 |
| 256 | 1769 |
| 512 | 1795 |
| 4096 | 1797 |
| 1024 | 1801 |
| 2048 | 1802 |
| 128 | 1814 |
| 64 | 1929 |
| stage | 2460 |

The limit of the stage: 4096 bits.

| Question | Answered | Wrong | Median precision | Largest precision | Median bound |
| --- | --- | --- | --- | --- | --- |
| sign | 4096 of 4096 | 0 | 64.00 | 512.0 | 1.084e-19 |
| abs 1e-9 | 4096 of 4096 | 0 | 64.00 | 128.0 | 2.711e-20 |
| rel 1e-12 | 4096 of 4096 | 0 | 64.00 | 512.0 | 0.000 |
| rel 0 | 3884 of 4096 | 0 | 128.0 | 512.0 | 0.000 |
| rel 1e-30 | 4096 of 4096 | 0 | 128.0 | 512.0 | 0.000 |
