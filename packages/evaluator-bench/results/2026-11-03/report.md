A ratio is the time of the stitched plan over the time of the fixed stage. Below 1, the stitched plan is faster.

| Fixed stage | Verdict | Median ratio | small | large | well | ill | orient-random | orient-near | incircle-random | incircle-near |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| float | slower | 2.512 | same 0.9980 | slower 4.328 | same 0.9983 | slower 99.51 | same 1.000 | slower 15.03 | faster 0.9990 | slower 107.3 |
| ball | cannot decide | 2.420 | cannot decide 0.9731 | slower 3.365 | faster 0.4477 | slower 29.77 | faster 0.6109 | slower 7.403 | faster 0.5061 | slower 48.91 |
| interval | cannot decide | 1.673 | faster 0.7203 | slower 2.700 | faster 0.1508 | slower 9.422 | faster 0.2017 | slower 3.337 | faster 0.1577 | slower 15.87 |
| exact | faster | 0.2771 | cannot decide 0.06518 | cannot decide 1.056 | faster 0.002676 | slower 1.185 | faster 0.01491 | faster 0.3294 | faster 0.01365 | faster 0.7021 |

The stitched answers that fail: **0**.

| Stage | Cost (ns for one node and one point) |
| --- | --- |
| float | 14.58 |
| ball | 27.92 |
| interval | 76.94 |
| exact | 858.9 |

| Question | Arm | Answered | Wrong | Median bound |
| --- | --- | --- | --- | --- |
| sign | float | 2332 of 4096 | 0 | 7.203e-15 |
| sign | ball | 2549 of 4096 | 0 | 2.038e-15 |
| sign | interval | 2926 of 4096 | 0 | 8.882e-16 |
| sign | exact | 3993 of 4096 | 0 | 1.489e-33 |
| sign | stitched | 4096 of 4096 | 0 | 2.578e-16 |
| abs 1e-9 | float | 2496 of 4096 | 0 | 1.205e-15 |
| abs 1e-9 | ball | 2556 of 4096 | 0 | 3.157e-16 |
| abs 1e-9 | interval | 3057 of 4096 | 0 | 3.886e-16 |
| abs 1e-9 | exact | 3993 of 4096 | 0 | 1.489e-33 |
| abs 1e-9 | stitched | 4096 of 4096 | 0 | 9.404e-16 |
| rel 1e-12 | float | 2088 of 4096 | 0 | 4.785e-15 |
| rel 1e-12 | ball | 2109 of 4096 | 0 | 9.453e-16 |
| rel 1e-12 | interval | 2656 of 4096 | 0 | 5.551e-16 |
| rel 1e-12 | exact | 3993 of 4096 | 0 | 1.489e-33 |
| rel 1e-12 | stitched | 4096 of 4096 | 0 | 3.818e-21 |
| rel 0 | float | 192 of 4096 | 0 | 0.000 |
| rel 0 | ball | 337 of 4096 | 0 | 0.000 |
| rel 0 | interval | 884 of 4096 | 0 | 0.000 |
| rel 0 | exact | 3993 of 4096 | 0 | 1.489e-33 |
| rel 0 | stitched | 4012 of 4096 | 0 | 1.102e-33 |

| Question | Selected plan | Expected cost (ns) |
| --- | --- | --- |
| sign | float, interval, exact | 293.0 |
| abs 1e-9 | float, interval, exact | 262.5 |
| rel 1e-12 | float, interval, exact | 354.2 |
| rel 0 | interval, exact | 750.5 |
