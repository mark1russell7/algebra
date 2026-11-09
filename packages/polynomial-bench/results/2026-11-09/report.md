A ratio is the time of arm `b` over the time of arm `a`. Below 1, arm `b` is faster.

| Pair | Verdict | Median ratio |
| --- | --- | --- |
| verbs | slower | 2.370 |
| points-1 | slower | 2.466 |
| points-64 | slower | 1.833 |
| equal | faster | 0.1402 |
| solve | slower | 1.197 |

| Family | verbs | points-1 | points-64 | equal | solve |
| --- | --- | --- | --- | --- | --- |
| well | slower 3.749 | slower 2.380 | slower 1.702 | faster 0.04475 |  |
| ill | slower 2.415 | slower 1.251 | cannot decide 0.9644 | faster 0.07382 |  |
| orient-random | slower 2.343 | slower 1.418 | slower 1.813 | faster 0.09802 |  |
| orient-near | slower 2.339 | slower 1.703 | slower 2.225 | faster 0.1090 |  |
| incircle-random | slower 2.318 | slower 2.639 | slower 4.173 | faster 0.1288 |  |
| incircle-near | slower 2.314 | slower 3.521 | slower 5.258 | faster 0.07819 |  |
| expand-v2-d4-t4 | slower 2.373 | slower 1.224 | cannot decide 0.9704 | faster 0.1371 |  |
| expand-v3-d6-t8 | slower 2.597 | slower 1.822 | slower 2.422 | faster 0.1408 |  |
| expand-v4-d8-t16 | slower 2.510 | slower 3.107 | slower 5.704 | faster 0.1642 |  |
| quotient-v1-d4-t3 |  | slower 2.006 | faster 0.7107 | faster 0.3248 |  |
| quotient-v2-d3-t4 |  | slower 3.036 | cannot decide 0.8972 | faster 0.4366 |  |
| quotient-v3-d3-t6 |  | slower 12.10 | slower 2.079 | cannot decide 1.289 |  |
| sum-v1-d3-t3 |  | slower 4.081 | slower 1.729 | faster 0.5436 |  |
| sum-v2-d2-t3 |  | slower 6.926 | slower 2.919 | cannot decide 1.010 |  |
| rational-roots-d8 |  |  |  |  | same 1.001 |
| rational-roots-d16 |  |  |  |  | same 0.9999 |
| mixed-roots-d12 |  |  |  |  | slower 1.447 |
| mixed-roots-d24 |  |  |  |  | slower 1.259 |
| dense-roots-d8 |  |  |  |  | slower 2.142 |
| dense-roots-d16 |  |  |  |  | slower 1.473 |
| dense-roots-d32 |  |  |  |  | slower 1.193 |
| dense-roots-d64 |  |  |  |  | slower 1.077 |

The break-even count of points: one form against the verb `exact` at the same points. Each time is a median, in milliseconds.

| Family | Cases | Exact fixed | Exact point | Form fixed | Form point | Points |
| --- | --- | --- | --- | --- | --- | --- |
| well | 8 | 0.1047 | 0.1976 | 0.3812 | 0.3340 | no crossing |
| ill | 8 | 0.07645 | 0.02832 | 0.1081 | 0.02687 | 22 |
| orient-random | 8 | 0.03218 | 0.009070 | 0.04142 | 0.01678 | no crossing |
| orient-near | 8 | 0.03453 | 0.008225 | 0.05482 | 0.01854 | no crossing |
| incircle-random | 8 | 0.2658 | 0.09658 | 0.5440 | 0.4084 | no crossing |
| incircle-near | 8 | 0.2803 | 0.1948 | 0.6609 | 1.039 | no crossing |
| expand-v2-d4-t4 | 8 | 0.1244 | 0.02092 | 0.1617 | 0.01987 | 36 |
| expand-v3-d6-t8 | 8 | 0.3002 | 0.06570 | 0.4956 | 0.1655 | no crossing |
| expand-v4-d8-t16 | 8 | 0.7170 | 0.1819 | 1.691 | 1.089 | no crossing |
| quotient-v1-d4-t3 | 8 | 0.09874 | 0.01238 | 0.2263 | 0.006509 | 22 |
| quotient-v2-d3-t4 | 8 | 0.1251 | 0.01737 | 0.4386 | 0.01172 | 56 |
| quotient-v3-d3-t6 | 8 | 0.1814 | 0.03244 | 2.735 | 0.02583 | 387 |
| sum-v1-d3-t3 | 7 | 0.1686 | 0.02401 | 0.7204 | 0.03298 | no crossing |
| sum-v2-d2-t3 | 8 | 0.1524 | 0.02383 | 1.248 | 0.05562 | no crossing |

The checks that disagree: **0** of 9602. The pairs not timed: 1.

| Verb | Tier | Family | Records | No claim | No value | Median ms |
| --- | --- | --- | --- | --- | --- | --- |
| polynomial | products/256 | well | 8 | 0 | 0 | 5.175 |
| rational | products/256 | well | 8 | 0 | 0 | 5.885 |
| polynomial | products/16 | well | 8 | 0 | 0 | 5.043 |
| rational | products/16 | well | 8 | 0 | 0 | 5.889 |
| polynomial | bits/8 | well | 8 | 0 | 0 | 4.776 |
| rational | bits/8 | well | 8 | 0 | 0 | 5.277 |
| polynomial | default | well | 8 | 0 | 0 | 5.332 |
| rational | default | well | 8 | 0 | 0 | 5.800 |
| polynomial | products/256 | ill | 8 | 0 | 0 | 0.7560 |
| rational | products/256 | ill | 8 | 0 | 0 | 0.9116 |
| polynomial | products/16 | ill | 8 | 0 | 0 | 0.7183 |
| rational | products/16 | ill | 8 | 0 | 0 | 0.8212 |
| polynomial | bits/8 | ill | 8 | 0 | 0 | 0.7104 |
| rational | bits/8 | ill | 8 | 0 | 0 | 0.9307 |
| polynomial | default | ill | 8 | 0 | 0 | 0.9004 |
| rational | default | ill | 8 | 0 | 0 | 0.8817 |
| polynomial | products/256 | orient-random | 8 | 0 | 0 | 0.3995 |
| rational | products/256 | orient-random | 8 | 0 | 0 | 0.4579 |
| polynomial | products/16 | orient-random | 8 | 0 | 0 | 0.3779 |
| rational | products/16 | orient-random | 8 | 0 | 0 | 0.4746 |
| polynomial | bits/8 | orient-random | 8 | 0 | 0 | 0.3988 |
| rational | bits/8 | orient-random | 8 | 0 | 0 | 0.4535 |
| polynomial | default | orient-random | 8 | 0 | 0 | 0.3544 |
| rational | default | orient-random | 8 | 0 | 0 | 0.4883 |
| polynomial | products/256 | orient-near | 8 | 0 | 0 | 0.3874 |
| rational | products/256 | orient-near | 8 | 0 | 0 | 0.4465 |
| polynomial | products/16 | orient-near | 8 | 0 | 0 | 0.3446 |
| rational | products/16 | orient-near | 8 | 0 | 0 | 0.4277 |
| polynomial | bits/8 | orient-near | 8 | 0 | 0 | 0.3340 |
| rational | bits/8 | orient-near | 8 | 0 | 0 | 0.3885 |
| polynomial | default | orient-near | 8 | 0 | 0 | 0.3395 |
| rational | default | orient-near | 8 | 0 | 0 | 0.4016 |
| polynomial | products/256 | incircle-random | 8 | 0 | 0 | 5.362 |
| rational | products/256 | incircle-random | 8 | 0 | 0 | 5.261 |
| polynomial | products/16 | incircle-random | 8 | 0 | 0 | 5.288 |
| rational | products/16 | incircle-random | 8 | 0 | 0 | 4.893 |
| polynomial | bits/8 | incircle-random | 8 | 0 | 0 | 4.440 |
| rational | bits/8 | incircle-random | 8 | 0 | 0 | 5.116 |
| polynomial | default | incircle-random | 8 | 0 | 0 | 4.542 |
| rational | default | incircle-random | 8 | 0 | 0 | 5.149 |
| polynomial | products/256 | incircle-near | 8 | 0 | 0 | 10.42 |
| rational | products/256 | incircle-near | 8 | 0 | 0 | 11.02 |
| polynomial | products/16 | incircle-near | 8 | 0 | 0 | 10.76 |
| rational | products/16 | incircle-near | 8 | 0 | 0 | 10.97 |
| polynomial | bits/8 | incircle-near | 8 | 0 | 0 | 10.62 |
| rational | bits/8 | incircle-near | 8 | 0 | 0 | 11.18 |
| polynomial | default | incircle-near | 8 | 0 | 0 | 10.52 |
| rational | default | incircle-near | 8 | 0 | 0 | 11.60 |
| polynomial | products/256 | expand-v2-d4-t4 | 8 | 0 | 0 | 0.6041 |
| rational | products/256 | expand-v2-d4-t4 | 8 | 0 | 0 | 0.8379 |
| polynomial | products/16 | expand-v2-d4-t4 | 8 | 0 | 0 | 0.5509 |
| rational | products/16 | expand-v2-d4-t4 | 8 | 0 | 0 | 0.7377 |
| polynomial | bits/8 | expand-v2-d4-t4 | 8 | 0 | 0 | 0.5205 |
| rational | bits/8 | expand-v2-d4-t4 | 8 | 0 | 0 | 0.6469 |
| polynomial | default | expand-v2-d4-t4 | 8 | 0 | 0 | 0.5494 |
| rational | default | expand-v2-d4-t4 | 8 | 0 | 0 | 0.6937 |
| polynomial | products/256 | expand-v3-d6-t8 | 8 | 0 | 0 | 2.532 |
| rational | products/256 | expand-v3-d6-t8 | 8 | 0 | 0 | 3.021 |
| polynomial | products/16 | expand-v3-d6-t8 | 8 | 0 | 0 | 2.277 |
| rational | products/16 | expand-v3-d6-t8 | 8 | 0 | 0 | 2.683 |
| polynomial | bits/8 | expand-v3-d6-t8 | 8 | 0 | 0 | 2.279 |
| rational | bits/8 | expand-v3-d6-t8 | 8 | 0 | 0 | 3.214 |
| polynomial | default | expand-v3-d6-t8 | 8 | 0 | 0 | 2.324 |
| rational | default | expand-v3-d6-t8 | 8 | 0 | 0 | 2.670 |
| polynomial | products/256 | expand-v4-d8-t16 | 8 | 0 | 0 | 11.86 |
| rational | products/256 | expand-v4-d8-t16 | 8 | 0 | 0 | 12.89 |
| polynomial | products/16 | expand-v4-d8-t16 | 8 | 0 | 0 | 11.78 |
| rational | products/16 | expand-v4-d8-t16 | 8 | 0 | 0 | 12.73 |
| polynomial | bits/8 | expand-v4-d8-t16 | 8 | 0 | 0 | 11.35 |
| rational | bits/8 | expand-v4-d8-t16 | 8 | 0 | 0 | 12.53 |
| polynomial | default | expand-v4-d8-t16 | 8 | 0 | 0 | 11.55 |
| rational | default | expand-v4-d8-t16 | 8 | 0 | 0 | 12.62 |
| polynomial | products/256 | quotient-v1-d4-t3 | 8 | 8 | 0 | 0.1524 |
| rational | products/256 | quotient-v1-d4-t3 | 8 | 0 | 0 | 0.7914 |
| polynomial | products/16 | quotient-v1-d4-t3 | 8 | 8 | 0 | 0.1577 |
| rational | products/16 | quotient-v1-d4-t3 | 8 | 0 | 0 | 0.9266 |
| polynomial | bits/8 | quotient-v1-d4-t3 | 8 | 8 | 0 | 0.1644 |
| rational | bits/8 | quotient-v1-d4-t3 | 8 | 0 | 0 | 0.7464 |
| polynomial | default | quotient-v1-d4-t3 | 8 | 8 | 0 | 0.1513 |
| rational | default | quotient-v1-d4-t3 | 8 | 0 | 0 | 0.6744 |
| polynomial | products/256 | quotient-v2-d3-t4 | 8 | 8 | 0 | 0.1601 |
| rational | products/256 | quotient-v2-d3-t4 | 8 | 0 | 0 | 1.381 |
| polynomial | products/16 | quotient-v2-d3-t4 | 8 | 8 | 0 | 0.1595 |
| rational | products/16 | quotient-v2-d3-t4 | 8 | 0 | 0 | 1.115 |
| polynomial | bits/8 | quotient-v2-d3-t4 | 8 | 8 | 0 | 0.1610 |
| rational | bits/8 | quotient-v2-d3-t4 | 8 | 0 | 0 | 1.191 |
| polynomial | default | quotient-v2-d3-t4 | 8 | 8 | 0 | 0.1629 |
| rational | default | quotient-v2-d3-t4 | 8 | 0 | 0 | 1.469 |
| polynomial | products/256 | quotient-v3-d3-t6 | 8 | 8 | 0 | 0.2119 |
| rational | products/256 | quotient-v3-d3-t6 | 8 | 2 | 0 | 3.634 |
| polynomial | products/16 | quotient-v3-d3-t6 | 8 | 8 | 0 | 0.2049 |
| rational | products/16 | quotient-v3-d3-t6 | 8 | 0 | 0 | 4.333 |
| polynomial | bits/8 | quotient-v3-d3-t6 | 8 | 8 | 0 | 0.2115 |
| rational | bits/8 | quotient-v3-d3-t6 | 8 | 0 | 0 | 3.279 |
| polynomial | default | quotient-v3-d3-t6 | 8 | 8 | 0 | 0.1902 |
| rational | default | quotient-v3-d3-t6 | 8 | 0 | 0 | 3.909 |
| polynomial | products/256 | sum-v1-d3-t3 | 8 | 7 | 1 | 0.1903 |
| rational | products/256 | sum-v1-d3-t3 | 8 | 0 | 1 | 1.548 |
| polynomial | products/16 | sum-v1-d3-t3 | 8 | 7 | 1 | 0.1765 |
| rational | products/16 | sum-v1-d3-t3 | 8 | 0 | 1 | 1.392 |
| polynomial | bits/8 | sum-v1-d3-t3 | 8 | 7 | 1 | 0.1718 |
| rational | bits/8 | sum-v1-d3-t3 | 8 | 0 | 1 | 1.057 |
| polynomial | default | sum-v1-d3-t3 | 8 | 7 | 1 | 0.1594 |
| rational | default | sum-v1-d3-t3 | 8 | 0 | 1 | 1.281 |
| polynomial | products/256 | sum-v2-d2-t3 | 8 | 8 | 0 | 0.1551 |
| rational | products/256 | sum-v2-d2-t3 | 8 | 3 | 0 | 2.024 |
| polynomial | products/16 | sum-v2-d2-t3 | 8 | 8 | 0 | 0.1553 |
| rational | products/16 | sum-v2-d2-t3 | 8 | 0 | 0 | 2.366 |
| polynomial | bits/8 | sum-v2-d2-t3 | 8 | 8 | 0 | 0.1656 |
| rational | bits/8 | sum-v2-d2-t3 | 8 | 0 | 0 | 2.007 |
| polynomial | default | sum-v2-d2-t3 | 8 | 8 | 0 | 0.1567 |
| rational | default | sum-v2-d2-t3 | 8 | 0 | 0 | 1.979 |
| rational | products/256 | rational-roots-d8 | 8 | 0 | 0 | 0.4870 |
| solve | products/256 | rational-roots-d8 | 8 | 0 | 0 | 0.8829 |
| rational | products/16 | rational-roots-d8 | 8 | 0 | 0 | 0.4890 |
| solve | products/16 | rational-roots-d8 | 8 | 0 | 0 | 0.9259 |
| rational | bits/8 | rational-roots-d8 | 8 | 0 | 0 | 0.4730 |
| solve | bits/8 | rational-roots-d8 | 8 | 0 | 0 | 0.7916 |
| rational | default | rational-roots-d8 | 8 | 0 | 0 | 0.5212 |
| solve | default | rational-roots-d8 | 8 | 0 | 0 | 0.8652 |
| rational | products/256 | rational-roots-d16 | 8 | 0 | 0 | 1.382 |
| solve | products/256 | rational-roots-d16 | 8 | 0 | 0 | 4.158 |
| rational | products/16 | rational-roots-d16 | 8 | 0 | 0 | 1.385 |
| solve | products/16 | rational-roots-d16 | 8 | 0 | 0 | 4.104 |
| rational | bits/8 | rational-roots-d16 | 8 | 0 | 0 | 1.322 |
| solve | bits/8 | rational-roots-d16 | 8 | 0 | 0 | 3.904 |
| rational | default | rational-roots-d16 | 8 | 0 | 0 | 1.423 |
| solve | default | rational-roots-d16 | 8 | 0 | 0 | 4.149 |
| rational | products/256 | mixed-roots-d12 | 8 | 0 | 0 | 0.6759 |
| solve | products/256 | mixed-roots-d12 | 8 | 0 | 0 | 6.288 |
| rational | products/16 | mixed-roots-d12 | 8 | 0 | 0 | 0.7057 |
| solve | products/16 | mixed-roots-d12 | 8 | 0 | 0 | 6.240 |
| rational | bits/8 | mixed-roots-d12 | 8 | 0 | 0 | 0.6815 |
| solve | bits/8 | mixed-roots-d12 | 8 | 0 | 0 | 7.091 |
| rational | default | mixed-roots-d12 | 8 | 0 | 0 | 0.6880 |
| solve | default | mixed-roots-d12 | 8 | 0 | 0 | 6.448 |
| rational | products/256 | mixed-roots-d24 | 8 | 0 | 0 | 2.278 |
| solve | products/256 | mixed-roots-d24 | 8 | 8 | 0 | 5.480 |
| rational | products/16 | mixed-roots-d24 | 8 | 0 | 0 | 2.383 |
| solve | products/16 | mixed-roots-d24 | 8 | 0 | 0 | 84.03 |
| rational | bits/8 | mixed-roots-d24 | 8 | 0 | 0 | 2.425 |
| solve | bits/8 | mixed-roots-d24 | 8 | 0 | 0 | 83.12 |
| rational | default | mixed-roots-d24 | 8 | 0 | 0 | 2.459 |
| solve | default | mixed-roots-d24 | 8 | 0 | 0 | 84.36 |
| rational | products/256 | dense-roots-d8 | 8 | 0 | 0 | 0.5364 |
| solve | products/256 | dense-roots-d8 | 8 | 0 | 0 | 4.221 |
| rational | products/16 | dense-roots-d8 | 8 | 0 | 0 | 0.5234 |
| solve | products/16 | dense-roots-d8 | 8 | 0 | 0 | 4.264 |
| rational | bits/8 | dense-roots-d8 | 8 | 0 | 0 | 0.5044 |
| solve | bits/8 | dense-roots-d8 | 8 | 0 | 0 | 4.088 |
| rational | default | dense-roots-d8 | 8 | 0 | 0 | 0.5177 |
| solve | default | dense-roots-d8 | 8 | 0 | 0 | 4.164 |
| rational | products/256 | dense-roots-d16 | 8 | 0 | 0 | 1.939 |
| solve | products/256 | dense-roots-d16 | 8 | 0 | 0 | 16.70 |
| rational | products/16 | dense-roots-d16 | 8 | 0 | 0 | 1.978 |
| solve | products/16 | dense-roots-d16 | 8 | 0 | 0 | 16.90 |
| rational | bits/8 | dense-roots-d16 | 8 | 0 | 0 | 1.887 |
| solve | bits/8 | dense-roots-d16 | 8 | 0 | 0 | 16.64 |
| rational | default | dense-roots-d16 | 8 | 0 | 0 | 1.944 |
| solve | default | dense-roots-d16 | 8 | 0 | 0 | 16.73 |
| rational | products/256 | dense-roots-d32 | 8 | 0 | 0 | 7.684 |
| solve | products/256 | dense-roots-d32 | 8 | 0 | 0 | 84.26 |
| rational | products/16 | dense-roots-d32 | 8 | 0 | 0 | 7.605 |
| solve | products/16 | dense-roots-d32 | 8 | 0 | 0 | 84.33 |
| rational | bits/8 | dense-roots-d32 | 8 | 0 | 0 | 7.420 |
| solve | bits/8 | dense-roots-d32 | 8 | 0 | 0 | 82.64 |
| rational | default | dense-roots-d32 | 8 | 0 | 0 | 7.601 |
| solve | default | dense-roots-d32 | 8 | 0 | 0 | 84.19 |
| rational | products/256 | dense-roots-d64 | 8 | 0 | 0 | 32.13 |
| solve | products/256 | dense-roots-d64 | 8 | 7 | 0 | 36.47 |
| rational | products/16 | dense-roots-d64 | 8 | 0 | 0 | 33.36 |
| solve | products/16 | dense-roots-d64 | 8 | 0 | 0 | 948.7 |
| rational | bits/8 | dense-roots-d64 | 8 | 0 | 0 | 31.73 |
| solve | bits/8 | dense-roots-d64 | 8 | 0 | 0 | 953.9 |
| rational | default | dense-roots-d64 | 8 | 0 | 0 | 32.02 |
| solve | default | dense-roots-d64 | 8 | 0 | 0 | 965.8 |
