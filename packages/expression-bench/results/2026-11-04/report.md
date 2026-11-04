The time of tape over the time of float: **faster**, median ratio 0.765.

| Family | Verdict | Median ratio |
| --- | --- | --- |
| small | cannot decide | 1.571 |
| large | faster | 0.844 |
| well | faster | 0.442 |
| ill | faster | 0.762 |
| orient-random | faster | 0.790 |
| orient-near | faster | 0.779 |
| incircle-random | faster | 0.352 |
| incircle-near | faster | 0.368 |

A ratio is the time of tape over the time of bound. The limit is 5.

All the cases: **beyond**, median ratio 3.882, A/A band [0.997, 1.003]. 21 of 64 cases are above the limit 5, the first is "small/s2".

| Family | Verdict | Median ratio | A/A band |
| --- | --- | --- | --- |
| small | beyond | 8.538 | A/A band [0.996, 1.004] |
| large | within | 1.010 | A/A band [0.985, 1.015] |
| well | within | 2.205 | A/A band [0.954, 1.049] |
| ill | within | 4.154 | A/A band [0.993, 1.007] |
| orient-random | within | 3.859 | A/A band [0.901, 1.110] |
| orient-near | within | 3.868 | A/A band [0.992, 1.008] |
| incircle-random | beyond | 5.985 | A/A band [0.976, 1.024] |
| incircle-near | beyond | 5.965 | A/A band [0.984, 1.016] |

| Case | Ratio | Interval | Bound | Outcome |
| --- | --- | --- | --- | --- |
| small/s1 | 1.040 | [1.036, 1.044] | 1.047 | within |
| small/s2 | 11.072 | [11.051, 11.093] | 11.129 | beyond |
| small/s3 | 1.010 | [1.006, 1.013] | 1.016 | within |
| small/s4 | 26.292 | [26.238, 26.400] | 26.485 | beyond |
| small/s5 | 11.105 | [11.071, 11.128] | 11.164 | beyond |
| small/s6 | 6.004 | [5.991, 6.017] | 6.036 | beyond |
| small/s7 | 1.823 | [1.817, 1.828] | 1.834 | within |
| small/s8 | 28.920 | [28.865, 28.973] | 29.067 | beyond |
| large/s1 | 1.007 | [1.003, 1.013] | 1.016 | within |
| large/s2 | 1.011 | [1.007, 1.013] | 1.016 | within |
| large/s3 | 1.103 | [1.100, 1.106] | 1.109 | within |
| large/s4 | 0.990 | [0.987, 0.993] | 0.996 | within |
| large/s5 | 1.017 | [1.009, 1.018] | 1.022 | within |
| large/s6 | 1.009 | [1.002, 1.016] | 1.020 | within |
| large/s7 | 1.037 | [1.034, 1.041] | 1.044 | within |
| large/s8 | 0.991 | [0.988, 0.995] | 0.998 | within |
| well/s1 | 2.241 | [2.238, 2.245] | 2.252 | within |
| well/s2 | 2.170 | [2.166, 2.177] | 2.184 | within |
| well/s3 | 2.083 | [2.079, 2.088] | 2.095 | within |
| well/s4 | 2.049 | [2.043, 2.056] | 2.063 | within |
| well/s5 | 2.155 | [2.149, 2.164] | 2.171 | within |
| well/s6 | 2.337 | [2.322, 2.344] | 2.352 | within |
| well/s7 | 2.522 | [2.510, 2.547] | 2.555 | within |
| well/s8 | 2.676 | [2.650, 2.679] | 2.688 | within |
| ill/s1 | 3.768 | [3.743, 3.786] | 3.798 | within |
| ill/s2 | 4.143 | [4.130, 4.158] | 4.171 | within |
| ill/s3 | 4.269 | [4.259, 4.287] | 4.301 | within |
| ill/s4 | 4.139 | [4.119, 4.158] | 4.172 | within |
| ill/s5 | 4.417 | [4.395, 4.442] | 4.457 | within |
| ill/s6 | 4.164 | [4.125, 4.172] | 4.186 | within |
| ill/s7 | 3.688 | [3.662, 3.711] | 3.723 | within |
| ill/s8 | 4.319 | [4.292, 4.340] | 4.354 | within |
| orient-random/s1 | 3.805 | [3.786, 3.833] | 3.846 | within |
| orient-random/s2 | 3.856 | [3.836, 3.875] | 3.888 | within |
| orient-random/s3 | 3.884 | [3.865, 3.908] | 3.921 | within |
| orient-random/s4 | 3.862 | [3.837, 3.880] | 3.893 | within |
| orient-random/s5 | 3.054 | [3.022, 3.154] | 3.165 | within |
| orient-random/s6 | 3.961 | [3.930, 4.026] | 4.039 | within |
| orient-random/s7 | 3.803 | [3.774, 3.813] | 3.825 | within |
| orient-random/s8 | 3.861 | [3.830, 3.880] | 3.893 | within |
| orient-near/s1 | 3.901 | [3.883, 3.917] | 3.929 | within |
| orient-near/s2 | 3.821 | [3.805, 3.834] | 3.846 | within |
| orient-near/s3 | 3.800 | [3.772, 3.817] | 3.830 | within |
| orient-near/s4 | 3.922 | [3.901, 3.935] | 3.948 | within |
| orient-near/s5 | 3.949 | [3.920, 3.971] | 3.984 | within |
| orient-near/s6 | 3.857 | [3.845, 3.888] | 3.900 | within |
| orient-near/s7 | 3.879 | [3.852, 3.893] | 3.905 | within |
| orient-near/s8 | 3.610 | [3.594, 3.629] | 3.641 | within |
| incircle-random/s1 | 6.130 | [6.091, 6.154] | 6.174 | beyond |
| incircle-random/s2 | 5.924 | [5.891, 5.965] | 5.984 | beyond |
| incircle-random/s3 | 6.015 | [5.975, 6.030] | 6.049 | beyond |
| incircle-random/s4 | 5.921 | [5.895, 5.943] | 5.962 | beyond |
| incircle-random/s5 | 5.988 | [5.977, 6.015] | 6.034 | beyond |
| incircle-random/s6 | 5.973 | [5.957, 5.999] | 6.018 | beyond |
| incircle-random/s7 | 6.012 | [5.984, 6.034] | 6.054 | beyond |
| incircle-random/s8 | 5.982 | [5.958, 6.007] | 6.027 | beyond |
| incircle-near/s1 | 5.961 | [5.949, 6.000] | 6.019 | beyond |
| incircle-near/s2 | 6.012 | [5.993, 6.044] | 6.064 | beyond |
| incircle-near/s3 | 6.003 | [5.975, 6.025] | 6.044 | beyond |
| incircle-near/s4 | 5.962 | [5.943, 5.987] | 6.006 | beyond |
| incircle-near/s5 | 5.964 | [5.941, 5.989] | 6.009 | beyond |
| incircle-near/s6 | 5.986 | [5.961, 6.012] | 6.031 | beyond |
| incircle-near/s7 | 5.966 | [5.935, 6.005] | 6.025 | beyond |
| incircle-near/s8 | 5.950 | [5.938, 5.975] | 5.994 | beyond |
